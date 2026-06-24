const cloud = require('wx-server-sdk');
const https = require('https');
const querystring = require('querystring');
const {
  FLAVOR_GROUPS,
  PROCESSING_GROUPS,
  ROAST_LEVEL_GROUPS,
  matchFlavorGroups,
  matchOrigin
} = require('./coffeeKnowledge.js');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const MAX_OCR_IMAGE_BYTES = 2 * 1024 * 1024;
const BAIDU_TOKEN_URL = process.env.BAIDU_TOKEN_URL || 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_OCR_API_URL = process.env.BAIDU_OCR_API_URL || 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';
const BAIDU_OCR_LANGUAGE = process.env.BAIDU_OCR_LANGUAGE || 'CHN_ENG';
const BAIDU_OCR_TIMEOUT_MS = Number(process.env.BAIDU_OCR_TIMEOUT_MS || 12000);
const OCR_SPACE_API_URL = process.env.OCR_SPACE_API_URL || 'https://api.ocr.space/parse/image';
const OCR_SPACE_ENGINE = process.env.OCR_SPACE_ENGINE || '2';
const OCR_SPACE_LANGUAGE = process.env.OCR_SPACE_LANGUAGE || 'auto';
const OCR_SPACE_TIMEOUT_MS = Number(process.env.OCR_SPACE_TIMEOUT_MS || 15000);
const OCR_PROVIDER = String(process.env.OCR_PROVIDER || 'baidu_ocr').toLowerCase();
let baiduAccessTokenCache = {
  token: '',
  expiresAt: 0
};
const AUTO_FILL_CONFIDENCE = 0.8;
const MIN_CANDIDATE_CONFIDENCE = 0.45;
const MAX_FIELD_CANDIDATES = 3;

exports.main = async (event = {}) => {
  if (!event.fileID) {
    return {
      ok: false,
      code: 'MISSING_FILE_ID',
      message: '没有收到图片'
    };
  }

  try {
    const file = await cloud.downloadFile({
      fileID: event.fileID
    });
    const buffer = Buffer.isBuffer(file.fileContent)
      ? file.fileContent
      : Buffer.from(file.fileContent);

    const contentType = getContentType(event.fileID);
    if (buffer.length > MAX_OCR_IMAGE_BYTES) {
      return {
        ok: false,
        code: 'IMAGE_TOO_LARGE',
        message: '图片超过2MB，请靠近包装文字重新拍摄或裁剪后重试'
      };
    }

    const ocrResult = await recognizeByProvider(buffer, contentType);
    const rawText = ocrResult.rawText;
    if (!rawText) {
      return {
        ok: false,
        code: 'EMPTY_OCR_TEXT',
        message: '没有识别到文字，请尽量正对包装文字拍摄'
      };
    }

    return {
      ok: true,
      provider: ocrResult.provider,
      providerWarnings: ocrResult.providerWarnings,
      rawText,
      ...parseBeanLabel(rawText)
    };
  } catch (err) {
    console.error('ocrBeanLabel failed:', err);
    const friendlyError = normalizeOcrError(err);
    return {
      ok: false,
      code: friendlyError.code,
      message: friendlyError.message
    };
  } finally {
    await deleteTempFile(event.fileID);
  }
};

async function recognizeByProvider(buffer, contentType) {
  const providerWarnings = [];
  if (OCR_PROVIDER === 'baidu_ocr' || (OCR_PROVIDER === 'auto' && hasBaiduOcrCredentials())) {
    try {
      const baiduResult = await recognizeWithBaiduOcr(buffer);
      const rawText = normalizeBaiduOcrText(baiduResult);
      if (rawText) {
        return {
          provider: 'baidu_ocr',
          providerWarnings,
          rawText
        };
      }
      providerWarnings.push({
        provider: 'baidu_ocr',
        code: 'EMPTY_OCR_TEXT',
        message: '百度 OCR 没有识别到文字'
      });
    } catch (err) {
      const friendlyError = normalizeBaiduOcrError(err);
      providerWarnings.push({
        provider: 'baidu_ocr',
        code: friendlyError.code,
        message: friendlyError.message
      });
      if (OCR_PROVIDER === 'baidu_ocr') {
        const forcedProviderError = new Error(friendlyError.message);
        forcedProviderError.code = friendlyError.code;
        forcedProviderError.providerWarnings = providerWarnings;
        throw forcedProviderError;
      }
    }
  }

  if (OCR_PROVIDER !== 'ocr_space' && OCR_PROVIDER !== 'baidu_ocr') {
    try {
      const wechatResult = await recognizePrintedText(buffer, contentType);
      const rawText = normalizeWechatOcrText(wechatResult);
      if (rawText) {
        return {
          provider: 'wechat_ocr',
          providerWarnings,
          rawText
        };
      }
      providerWarnings.push({
        provider: 'wechat_ocr',
        code: 'EMPTY_OCR_TEXT',
        message: '微信 OCR 没有识别到文字'
      });
    } catch (err) {
      const friendlyError = normalizeOcrError(err);
      providerWarnings.push({
        provider: 'wechat_ocr',
        code: friendlyError.code,
        message: friendlyError.message
      });
    }
  }

  const apiKey = getOcrSpaceApiKey();
  if (!apiKey) {
    const primaryError = providerWarnings[0] || {};
    const prefix = primaryError.message ? `${primaryError.message}；` : '';
    const missingKeyError = new Error(`${prefix}备用 OCR 未启用，请配置云函数环境变量 OCR_SPACE_API_KEY`);
    missingKeyError.code = 'OCR_SPACE_API_KEY_MISSING';
    throw missingKeyError;
  }

  try {
    const ocrSpaceResult = await recognizeWithOcrSpace(buffer, contentType, apiKey);
    const rawText = normalizeOcrSpaceText(ocrSpaceResult);
    if (rawText) {
      return {
        provider: 'ocr_space',
        providerWarnings,
        rawText
      };
    }
    const emptyError = new Error('备用 OCR 没有识别到文字，请尽量正对包装文字拍摄');
    emptyError.code = 'EMPTY_OCR_TEXT';
    throw emptyError;
  } catch (err) {
    const friendlyError = normalizeOcrSpaceError(err);
    const fallbackError = new Error(friendlyError.message);
    fallbackError.code = friendlyError.code;
    fallbackError.providerWarnings = providerWarnings;
    throw fallbackError;
  }
}

function normalizeBaiduOcrError(err = {}) {
  const rawMessage = String(err.errMsg || err.message || '');
  const rawCode = err.error_code || err.errCode || err.code || 'BAIDU_OCR_FAILED';
  const rawText = `${rawCode} ${rawMessage}`;
  const numericCode = Number(rawCode);
  if (/api key|secret key|invalid_client|authentication|permission|access_token|unknown client|client authentication/i.test(rawText)
    || numericCode === 110
    || numericCode === 111) {
    return {
      code: 'BAIDU_OCR_AUTH_ERROR',
      message: '百度 OCR 鉴权失败，请检查 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY'
    };
  }
  if (/quota|limit|qps|daily request/i.test(rawText) || numericCode === 17 || numericCode === 18 || numericCode === 19) {
    return {
      code: 'BAIDU_OCR_QUOTA_LIMIT',
      message: '百度 OCR 额度或频率受限，请稍后重试或检查免费额度'
    };
  }
  if (/image|base64|size|too large/i.test(rawText)
    || numericCode === 216200
    || numericCode === 216201
    || numericCode === 216202) {
    return {
      code: 'BAIDU_OCR_IMAGE_ERROR',
      message: '百度 OCR 无法处理这张图片，请裁剪包装文字区域后重试'
    };
  }
  if (/timeout|timed out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(rawText)) {
    return {
      code: 'BAIDU_OCR_TIMEOUT',
      message: '百度 OCR 响应超时，请稍后重试'
    };
  }
  return {
    code: rawCode,
    message: rawMessage || '百度 OCR 识别失败'
  };
}

function normalizeOcrError(err = {}) {
  const rawMessage = String(err.errMsg || err.message || '');
  const rawCode = err.errCode || err.code || 'OCR_FAILED';
  if (/not enough market quota/i.test(rawMessage) || rawCode === 101003) {
    return {
      code: 'OCR_MARKET_QUOTA_NOT_ENOUGH',
      message: '微信 OCR 服务额度不足或未开通，请在云开发服务市场领取/购买 OCR 通用印刷体识别额度后重试'
    };
  }
  if (/invalid credential|access_token|unauthorized|permission/i.test(rawMessage)) {
    return {
      code: 'OCR_PERMISSION_ERROR',
      message: '微信 OCR 调用权限异常，请检查云函数权限和 OCR 服务是否已开通'
    };
  }
  if (/decode image failed|invalid image/i.test(rawMessage)) {
    return {
      code: 'OCR_IMAGE_DECODE_FAILED',
      message: '图片解析失败，请重新拍摄清晰的 JPG 或 PNG 图片'
    };
  }
  return {
    code: rawCode,
    message: rawMessage || 'OCR识别失败'
  };
}

function normalizeOcrSpaceError(err = {}) {
  const rawMessage = String(err.errMsg || err.message || '');
  const rawCode = err.errCode || err.code || 'OCR_SPACE_FAILED';
  if (/apikey|api key|unauthorized|invalid/i.test(rawMessage)) {
    return {
      code: 'OCR_SPACE_API_KEY_INVALID',
      message: '备用 OCR API Key 无效，请检查云函数环境变量 OCR_SPACE_API_KEY'
    };
  }
  if (/maximum file size|file size|too large|1\s*mb/i.test(rawMessage)) {
    return {
      code: 'OCR_SPACE_IMAGE_TOO_LARGE',
      message: '备用 OCR 免费额度要求图片小于1MB，请靠近包装文字重新拍摄或裁剪后重试'
    };
  }
  if (/timeout|timed out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(rawMessage)) {
    return {
      code: 'OCR_SPACE_TIMEOUT',
      message: '备用 OCR 响应超时，请稍后重试'
    };
  }
  if (/quota|rate|limit|conversion/i.test(rawMessage)) {
    return {
      code: 'OCR_SPACE_QUOTA_LIMIT',
      message: '备用 OCR 额度或频率受限，请稍后重试或更换 OCR.space API Key'
    };
  }
  return {
    code: rawCode,
    message: rawMessage || '备用 OCR 识别失败'
  };
}

function recognizePrintedText(buffer, contentType) {
  return cloud.openapi.ocr.printedText({
    type: 'photo',
    img: {
      contentType,
      value: buffer
    }
  });
}

async function recognizeWithBaiduOcr(buffer) {
  const accessToken = await getBaiduAccessToken();
  const formData = querystring.stringify({
    image: buffer.toString('base64'),
    language_type: BAIDU_OCR_LANGUAGE,
    detect_direction: 'true',
    paragraph: 'false',
    probability: 'true'
  });
  const url = `${BAIDU_OCR_API_URL}?access_token=${encodeURIComponent(accessToken)}`;

  return postForm(url, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formData)
  }, formData, BAIDU_OCR_TIMEOUT_MS).then((result) => {
    if (!result || typeof result !== 'object') {
      const error = new Error('百度 OCR 返回为空');
      error.code = 'BAIDU_OCR_EMPTY_RESPONSE';
      throw error;
    }
    if (result.error_code) {
      const error = new Error(result.error_msg || '百度 OCR 处理失败');
      error.code = result.error_code;
      error.error_code = result.error_code;
      throw error;
    }
    return result;
  });
}

async function getBaiduAccessToken() {
  if (baiduAccessTokenCache.token && Date.now() < baiduAccessTokenCache.expiresAt) {
    return baiduAccessTokenCache.token;
  }

  const apiKey = getBaiduOcrApiKey();
  const secretKey = getBaiduOcrSecretKey();
  if (!apiKey || !secretKey) {
    const error = new Error('百度 OCR 未启用，请配置 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY');
    error.code = 'BAIDU_OCR_KEY_MISSING';
    throw error;
  }

  const url = `${BAIDU_TOKEN_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`;
  return postForm(url, {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Content-Length': 0
  }, '', BAIDU_OCR_TIMEOUT_MS).then((result) => {
    if (!result || typeof result !== 'object') {
      const error = new Error('百度 OCR token 返回为空');
      error.code = 'BAIDU_OCR_TOKEN_EMPTY';
      throw error;
    }
    if (result.error) {
      const error = new Error(result.error_description || result.error);
      error.code = result.error;
      throw error;
    }
    if (!result.access_token) {
      const error = new Error('百度 OCR token 缺少 access_token');
      error.code = 'BAIDU_OCR_TOKEN_MISSING';
      throw error;
    }
    const expiresInMs = Math.max(0, Number(result.expires_in || 0) * 1000);
    baiduAccessTokenCache = {
      token: result.access_token,
      expiresAt: Date.now() + Math.max(0, expiresInMs - 5 * 60 * 1000)
    };
    return result.access_token;
  });
}

function recognizeWithOcrSpace(buffer, contentType, apiKey) {
  const base64Image = `data:${contentType};base64,${buffer.toString('base64')}`;
  const formData = querystring.stringify({
    base64Image,
    language: OCR_SPACE_LANGUAGE,
    isOverlayRequired: 'false',
    detectOrientation: 'true',
    scale: 'true',
    OCREngine: OCR_SPACE_ENGINE
  });

  return postForm(OCR_SPACE_API_URL, {
    apikey: apiKey,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formData)
  }, formData).then((result) => {
    if (!result || typeof result !== 'object') {
      const error = new Error('备用 OCR 返回为空');
      error.code = 'OCR_SPACE_EMPTY_RESPONSE';
      throw error;
    }

    if (result.IsErroredOnProcessing || Number(result.OCRExitCode) >= 3) {
      const message = stringifyOcrSpaceError(result.ErrorMessage || result.ErrorDetails);
      const error = new Error(message || '备用 OCR 处理失败');
      error.code = 'OCR_SPACE_PROCESSING_ERROR';
      throw error;
    }

    const pageErrors = (result.ParsedResults || [])
      .map(page => page && (page.ErrorMessage || page.ErrorDetails))
      .filter(Boolean);
    if (pageErrors.length) {
      const error = new Error(stringifyOcrSpaceError(pageErrors));
      error.code = 'OCR_SPACE_PAGE_ERROR';
      throw error;
    }

    return result;
  });
}

function postForm(url, headers, body, timeoutMs = OCR_SPACE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST',
      headers,
      timeout: timeoutMs
    }, (response) => {
      let responseText = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        responseText += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(`备用 OCR HTTP ${response.statusCode}`);
          error.code = 'OCR_SPACE_HTTP_ERROR';
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(responseText));
        } catch (err) {
          err.code = 'OCR_SPACE_INVALID_JSON';
          reject(err);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('备用 OCR 请求超时'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function hasBaiduOcrCredentials() {
  return Boolean(getBaiduOcrApiKey() && getBaiduOcrSecretKey());
}

function getBaiduOcrApiKey() {
  return String(process.env.BAIDU_OCR_API_KEY || process.env.BAIDU_API_KEY || '').trim();
}

function getBaiduOcrSecretKey() {
  return String(process.env.BAIDU_OCR_SECRET_KEY || process.env.BAIDU_SECRET_KEY || '').trim();
}

function getOcrSpaceApiKey() {
  return String(process.env.OCR_SPACE_API_KEY || '').trim();
}

function stringifyOcrSpaceError(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join('；');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value || '');
}

function getContentType(fileID = '') {
  const text = String(fileID).toLowerCase();
  if (text.endsWith('.png')) return 'image/png';
  if (text.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function deleteTempFile(fileID) {
  try {
    await cloud.deleteFile({
      fileList: [fileID]
    });
  } catch (e) {}
}

function normalizeWechatOcrText(result = {}) {
  if (Array.isArray(result.items)) {
    return result.items
      .map(item => (typeof item === 'string' ? item : item.text))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof result.items === 'string') return result.items;
  if (typeof result.text === 'string') return result.text;
  return '';
}

function normalizeBaiduOcrText(result = {}) {
  if (!Array.isArray(result.words_result)) return '';
  return result.words_result
    .map(item => item && item.words)
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeOcrSpaceText(result = {}) {
  if (!Array.isArray(result.ParsedResults)) return '';
  return result.ParsedResults
    .map(page => page && page.ParsedText)
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseBeanLabel(rawText) {
  const lines = splitLines(rawText);
  const fullText = lines.join('\n');
  const draft = {};
  const candidates = buildRequiredFieldCandidates(lines, fullText);
  const originMatch = matchOrigin(fullText);

  const name = getAutoCandidateValue(candidates.name);
  const origin = extractByLabels(lines, ['产地', '产区', '庄园', 'Origin', 'Region', 'Farm'])
    || (originMatch && originMatch.originText)
    || extractOrigin(fullText);
  const roaster = extractByLabels(lines, ['烘焙商', '烘豆师', '出品', '品牌', 'Roaster', 'Roasted by']);
  const roastDate = getAutoCandidateValue(candidates.roastDate);
  const roastLevel = getAutoCandidateValue(candidates.roastLevel);
  const processing = getAutoCandidateValue(candidates.processing);
  const flavorNotes = getAutoCandidateValue(candidates.flavorNotes);
  const stockGrams = extractStockGrams(fullText);

  if (name) draft.name = name;
  if (origin) draft.origin = origin;
  if (roaster) draft.roaster = roaster;
  if (roastDate) draft.roastDate = roastDate;
  if (roastLevel) draft.roastLevel = roastLevel;
  if (processing) draft.processing = processing;
  if (flavorNotes) draft.flavorNotes = normalizeFlavorText(flavorNotes);
  if (stockGrams) draft.stockGrams = stockGrams;

  return {
    draft,
    candidates
  };
}

function buildRequiredFieldCandidates(lines, fullText) {
  return {
    name: limitCandidates(buildNameCandidates(lines)),
    roastDate: limitCandidates(buildDateCandidates(lines, fullText)),
    roastLevel: limitCandidates(buildRoastLevelCandidates(lines, fullText)),
    processing: limitCandidates(buildProcessingCandidates(lines, fullText)),
    flavorNotes: limitCandidates(buildFlavorCandidates(lines, fullText))
  };
}

function getAutoCandidateValue(candidates = []) {
  const matched = candidates.find(item => Number(item.confidence) >= AUTO_FILL_CONFIDENCE);
  return matched ? matched.value : '';
}

function limitCandidates(candidates = []) {
  const seen = new Set();
  return candidates
    .filter(item => item && item.value !== undefined && item.value !== null && String(item.value).trim() !== '')
    .map(item => ({
      ...item,
      value: String(item.value).trim(),
      displayValue: String(item.displayValue || item.label || item.value).trim(),
      confidence: Number(Number(item.confidence || 0).toFixed(2))
    }))
    .filter(item => item.confidence >= MIN_CANDIDATE_CONFIDENCE)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return 0;
    })
    .filter(item => {
      const key = normalizeCandidateKey(item.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_FIELD_CANDIDATES);
}

function normalizeCandidateKey(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').trim();
}

function buildNameCandidates(lines) {
  const candidates = [];
  const labeled = extractByStrictLabels(lines, ['商品名', '名称', '品名', '豆名', 'Product Name', 'Coffee Name', 'Name']);
  if (labeled) {
    candidates.push(createCandidate(cleanNameCandidate(labeled), 0.9, '标签识别'));
  }

  lines.slice(0, 8).forEach((line, index) => {
    const value = cleanNameCandidate(line);
    if (!isLikelyNameLine(value)) return;
    const confidence = index <= 1 ? 0.76 : 0.62;
    candidates.push(createCandidate(value, confidence, `第${index + 1}行`));
  });

  return candidates;
}

function buildDateCandidates(lines, fullText) {
  const candidates = [];
  const roastLabels = ['烘焙日期', '烘焙时间', '烘焙于', '烘豆日期', 'Roast Date', 'Roasted On', 'Roasted', 'Roasting Date'];
  const productionLabels = ['生产日期', '制造日期', '包装日期', '装袋日期', 'Production Date', 'Produced On', 'MFG', 'MFD', 'Packed On', 'Packing Date'];
  const expiryPattern = /(保质期|有效期|到期|赏味期限|expiry|expire|best\s*before|shelf\s*life)/i;
  const roasterPattern = /(烘焙商|烘豆师|roaster|roasted\s+by)/i;

  lines.forEach((line, index) => {
    if (expiryPattern.test(line)) return;
    if (roasterPattern.test(line)) return;
    const nextLine = lines[index + 1] || '';
    const combined = `${line} ${nextLine}`;
    if (hasTextLabel(line, roastLabels)) {
      const date = extractDateValue(combined);
      if (date) candidates.push(createCandidate(date, 0.92, '烘焙日期', `烘焙日期 ${date}`));
      return;
    }
    if (hasTextLabel(line, productionLabels)) {
      const date = extractDateValue(combined);
      if (date) candidates.push(createCandidate(date, 0.82, '生产日期', `生产日期 ${date}`));
    }
  });

  if (!candidates.length) {
    const date = extractDateValue(fullText);
    if (date) candidates.push(createCandidate(date, 0.55, '全文日期', date));
  }

  return candidates;
}

function buildRoastLevelCandidates(lines, fullText) {
  const source = fullText;
  const labeledText = collectLabeledContext(lines, ['烘焙度', '烘焙程度', '烘焙', 'Roast Level', 'Roast'], /(烘焙商|烘豆师|roaster|roasted\s+by)/i);
  return ROAST_LEVEL_GROUPS
    .map(group => {
      const inLabeled = hasAliasInText(labeledText, group.aliases);
      const inFullText = hasAliasInText(source, group.aliases);
      if (!inLabeled && !inFullText) return null;
      return createCandidate(group.id, inLabeled ? 0.9 : 0.72, inLabeled ? '烘焙度标签' : '全文匹配', group.label);
    })
    .filter(Boolean);
}

function buildProcessingCandidates(lines, fullText) {
  const source = fullText;
  const labeledText = collectLabeledContext(lines, ['处理法', '处理方式', '处理', 'Process', 'Processing', 'Method'], /(brew\s*method|冲煮|萃取)/i);
  return PROCESSING_GROUPS
    .map(group => {
      const inLabeled = hasAliasInText(labeledText, group.aliases);
      const inFullText = hasAliasInText(source, group.aliases);
      if (!inLabeled && !inFullText) return null;
      return createCandidate(group.id, inLabeled ? 0.9 : 0.74, inLabeled ? '处理法标签' : '全文匹配', group.label);
    })
    .filter(Boolean);
}

function buildFlavorCandidates(lines, fullText) {
  const labeled = extractFlavorByLabels(lines);
  const matched = extractMatchedFlavorTerms(fullText);
  const candidates = [];
  if (labeled) candidates.push(createCandidate(normalizeFlavorText(labeled), 0.84, '风味标签'));
  if (matched) candidates.push(createCandidate(matched, labeled ? 0.68 : 0.74, '风味词库'));
  return candidates;
}

function createCandidate(value, confidence, source, displayValue = '') {
  return {
    value,
    displayValue: displayValue || value,
    confidence,
    source
  };
}

function cleanNameCandidate(value) {
  return cleanValue(value)
    .replace(/^(商品名|名称|品名|豆名|name|product name|coffee name)\s*[:：\-\s]+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyNameLine(line) {
  const value = String(line || '').trim();
  if (value.length < 2 || value.length > 42) return false;
  if (/^(specialty\s+)?coffee(\s+beans)?$/i.test(value)) return false;
  if (/(烘焙|日期|产地|产区|庄园|处理|风味|净含量|重量|规格|海拔|品种|roast|date|origin|region|farm|process|flavo[u]?r|weight|net\s*wt|altitude|variet|producer|\d{2,4}\s*(g|克))/i.test(value)) return false;
  return /[\u4e00-\u9fa5A-Za-z]/.test(value);
}

function hasTextLabel(text, labels = []) {
  const lower = String(text || '').toLowerCase();
  return labels.some(label => lower.includes(String(label).toLowerCase()));
}

function extractByStrictLabels(lines, labels) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const label of labels) {
      const pattern = new RegExp(`^\\s*${escapeRegex(label)}\\s*[:：\\-]?\\s*`, 'i');
      if (!pattern.test(line)) continue;
      const value = cleanValue(line.replace(pattern, ''));
      if (value) return value;
      if (lines[i + 1]) return cleanValue(lines[i + 1]);
    }
  }
  return '';
}

function collectLabeledContext(lines, labels = [], excludePattern = null) {
  const chunks = [];
  lines.forEach((line, index) => {
    if (excludePattern && excludePattern.test(String(line || ''))) return;
    if (!hasTextLabel(line, labels)) return;
    chunks.push(line);
    if (lines[index + 1]) chunks.push(lines[index + 1]);
  });
  return chunks.join('\n');
}

function hasAliasInText(text, aliases = []) {
  const source = normalizeText(text);
  if (!source) return false;
  return aliases.some(alias => source.includes(normalizeText(alias)));
}

function extractDateValue(text) {
  const source = String(text || '');
  const match = source.match(/(20\d{2})[.\-/年](\d{1,2})[.\-/月](\d{1,2})日?/)
    || source.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/);
  if (!match) return '';

  const year = match[1].length === 4 ? Number(match[1]) : Number(match[3]);
  const month = match[1].length === 4 ? Number(match[2]) : Number(match[2]);
  const day = match[1].length === 4 ? Number(match[3]) : Number(match[1]);
  return formatValidDate(year, month, day);
}

function formatValidDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return '';
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return [
    String(year),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

function extractFlavorNotes(lines, fullText) {
  const labeled = extractFlavorByLabels(lines);
  if (labeled) return labeled;
  return extractMatchedFlavorTerms(fullText);
}

function extractFlavorByLabels(lines) {
  const labels = [
    '风味描述',
    '风味',
    '风味 notes',
    'Flavor Notes',
    'Flavour Notes',
    'Tasting Notes',
    'Taste Notes',
    'Flavor',
    'Flavour'
  ];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lower = line.toLowerCase();
    for (const label of labels) {
      const index = lower.indexOf(String(label).toLowerCase());
      if (index < 0) continue;

      const value = cleanFlavorValue(line.slice(index + String(label).length));
      if (value) return value;

      const collected = [];
      for (let j = i + 1; j < lines.length && j <= i + 4; j += 1) {
        const nextLine = lines[j];
        if (isLikelySectionLine(nextLine)) break;
        if (!looksLikeFlavorLine(nextLine) && collected.length) break;
        if (!looksLikeFlavorLine(nextLine)) continue;
        collected.push(cleanFlavorValue(nextLine));
        if (collected.join('、').length >= 80) break;
      }
      if (collected.length) return collected.filter(Boolean).join('、');
    }
  }
  return '';
}

function extractMatchedFlavorTerms(text) {
  const source = String(text || '');
  const matches = [];

  FLAVOR_GROUPS.forEach(group => {
    (group.aliases || []).forEach(alias => {
      const pattern = escapeRegex(alias).replace(/\s+/g, '\\s+');
      const regex = new RegExp(pattern, 'gi');
      let match = regex.exec(source);
      while (match) {
        matches.push({
          text: match[0],
          index: match.index,
          end: match.index + match[0].length
        });
        match = regex.exec(source);
      }
    });
  });

  matches.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return (b.end - b.index) - (a.end - a.index);
  });

  const usedRanges = [];
  const seen = new Set();
  const terms = [];
  matches.forEach(match => {
    const overlaps = usedRanges.some(range => match.index < range.end && match.end > range.index);
    if (overlaps) return;
    const term = cleanFlavorValue(match.text);
    const key = normalizeFlavorTerm(term);
    if (!term || seen.has(key)) return;
    seen.add(key);
    usedRanges.push({ index: match.index, end: match.end });
    terms.push(term);
  });

  return normalizeFlavorText(terms.join('、'));
}

function looksLikeFlavorLine(line) {
  const value = cleanFlavorValue(line);
  if (!value || value.length > 80) return false;
  return matchFlavorGroups(value).length > 0;
}

function isLikelySectionLine(line) {
  return /(产地|产区|庄园|处理|烘焙|日期|净含量|重量|规格|海拔|品种|origin|region|farm|process|roast|date|weight|net\s*wt|altitude|variety|varietal)/i.test(String(line || ''));
}

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractByLabels(lines, labels) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lower = line.toLowerCase();
    for (const label of labels) {
      const index = lower.indexOf(String(label).toLowerCase());
      if (index < 0) continue;
      const value = cleanValue(line.slice(index + String(label).length));
      if (value) return value;
      if (lines[i + 1]) return cleanValue(lines[i + 1]);
    }
  }
  return '';
}

function extractStockGrams(text) {
  const value = String(text || '');
  const labeled = value.match(/(?:净含量|重量|规格|net\s*wt|weight)[^\d]{0,16}(\d{2,4})\s*(?:g|克)/i);
  if (labeled) return labeled[1];

  const all = Array.from(value.matchAll(/(\d{2,4})\s*(?:g|克)/gi))
    .map(match => Number(match[1]))
    .filter(number => number >= 50 && number <= 1000);
  return all.length ? String(all[0]) : '';
}

function extractOrigin(text) {
  const origins = [
    '埃塞俄比亚',
    '肯尼亚',
    '哥伦比亚',
    '巴拿马',
    '哥斯达黎加',
    '危地马拉',
    '洪都拉斯',
    '萨尔瓦多',
    '尼加拉瓜',
    '巴西',
    '秘鲁',
    '云南',
    '印尼',
    '苏门答腊'
  ];
  return origins.find(origin => String(text || '').indexOf(origin) >= 0) || '';
}

function extractName(lines) {
  const labelName = extractByLabels(lines, ['名称', '品名', '豆名', 'Name']);
  if (labelName) return labelName;

  return lines.find(line => {
    if (line.length < 2 || line.length > 36) return false;
    if (/^(specialty\s+)?coffee(\s+beans)?$/i.test(line)) return false;
    if (/(烘焙|日期|产地|产区|处理|风味|净含量|重量|规格|roast|origin|process|flavor|weight|net\s*wt|\d{2,4}\s*(g|克))/i.test(line)) return false;
    return /[\u4e00-\u9fa5A-Za-z]/.test(line);
  }) || '';
}

function normalizeFlavorText(value) {
  return cleanValue(value)
    .replace(/[;；/]/g, '、')
    .replace(/[，,]/g, '、')
    .replace(/\r?\n+/g, '、')
    .replace(/\s*、\s*/g, '、')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/、{2,}/g, '、')
    .replace(/^、|、$/g, '');
}

function cleanFlavorValue(value) {
  return cleanValue(value)
    .replace(/^(notes?|flavo[u]?r|tasting|taste)\s*[:：\-\s]+/i, '')
    .replace(/^(风味描述|风味)\s*[:：\-\s]+/, '')
    .trim();
}

function normalizeFlavorTerm(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanValue(value) {
  return String(value || '')
    .replace(/^[:：\-\s]+/, '')
    .replace(/[|｜]+/g, ' ')
    .trim();
}
