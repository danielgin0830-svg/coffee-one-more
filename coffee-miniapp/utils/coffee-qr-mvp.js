const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3210';
const API_BASE_URL_STORAGE_KEY = 'coffeeQrApiBaseUrl';
const BEAN_DRAFT_FIELDS = [
  'name',
  'origin',
  'roaster',
  'roastDate',
  'roastLevel',
  'processing',
  'flavorNotes',
  'stockGrams',
  'altitude',
  'regionLot',
  'variety'
];

function getApiBaseUrl() {
  const saved = wx.getStorageSync(API_BASE_URL_STORAGE_KEY);
  return String(saved || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function requestCoffeeQrApi(path, options = {}) {
  return requestCoffeeQrUrl(getApiBaseUrl() + path, options);
}

function requestCoffeeQrUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 12000,
      header: { 'content-type': 'application/json' },
      success: (res) => {
        const data = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && data.ok !== false) {
          resolve(data);
          return;
        }
        reject(new Error(data.message || `本地服务返回 ${res.statusCode}`));
      },
      fail: (error) => reject(new Error(error.errMsg || '本地发行服务未连接'))
    });
  });
}

function getShortBatchApiUrl(qrText) {
  const match = /^(https?:\/\/[^/]+)\/b\/([A-Z0-9_-]{10})\/?$/i.exec(String(qrText || '').trim());
  return match ? `${match[1]}/api/public/batches/${match[2].toUpperCase()}` : '';
}

function buildBeanFromDecoded(result = {}) {
  const batch = result.batch || {};
  const resolved = result.resolved || {};
  const entities = Array.isArray(resolved.entities) ? resolved.entities : [];
  const varieties = Array.isArray(resolved.varieties) ? resolved.varieties : [];
  const processes = Array.isArray(resolved.processes) ? resolved.processes : [];
  const processing = mapProcessing(processes);
  const now = new Date().toISOString();

  return {
    name: String(batch.productName || '').trim(),
    origin: displayName(resolved.country || {}),
    roaster: String(batch.issuerName || '').trim(),
    roastDate: String(batch.roastDate || '').trim(),
    roastLevel: mapRoastLevel(batch.roastLevel),
    processing,
    flavorNotes: String(batch.flavorNotes || '').trim(),
    stockGrams: normalizeStock(batch.netWeightG),
    altitude: formatAltitude(batch.altitudeMinM, batch.altitudeMaxM),
    regionLot: entities.map(item => displayName(item.entity || {})).filter(Boolean).join(' · '),
    variety: varieties.map(displayName).filter(Boolean).join(' / '),
    coverImage: '',
    coverImageFileID: '',
    id: Date.now().toString(),
    tags: [processing].filter(Boolean),
    createdAt: now,
    updatedAt: now,
    qrSource: 'coffee-open-format',
    qrProtocolVersion: batch.protocolVersion,
    qrRegistryVersion: batch.registryVersion,
    qrIssuerId: batch.issuerId,
    qrIssuerName: batch.issuerName,
    qrBatchId: batch.batchId,
    qrPayloadHash: result.payloadHash,
    qrSignatureStatus: result.signatureStatus,
    qrIssuerStatus: result.issuerStatus,
    qrProcessingText: processes.map(displayName).filter(Boolean).join(' / '),
    qrImportedAt: now
  };
}

function buildPreview(result = {}) {
  const batch = result.batch || {};
  const resolved = result.resolved || {};
  const entities = Array.isArray(resolved.entities) ? resolved.entities : [];
  const varieties = Array.isArray(resolved.varieties) ? resolved.varieties : [];
  const processes = Array.isArray(resolved.processes) ? resolved.processes : [];
  return {
    productName: batch.productName || '未命名豆子',
    issuerName: batch.issuerName || '未知发行方',
    batchId: batch.batchId || '',
    originText: displayName(resolved.country || {}) || '未知产地',
    entityText: entities.map(item => displayName(item.entity || {})).filter(Boolean).join(' · ') || '未填写',
    varietyText: varieties.map(displayName).filter(Boolean).join(' / ') || '未填写',
    processText: processes.map(displayName).filter(Boolean).join(' / ') || '未填写',
    roastDate: batch.roastDate || '未填写',
    roastLevelText: getRoastLevelText(batch.roastLevel),
    stockText: batch.netWeightG ? `${batch.netWeightG} 克` : '未填写',
    altitudeText: formatAltitude(batch.altitudeMinM, batch.altitudeMaxM) || '未填写',
    flavorNotes: batch.flavorNotes || '未填写',
    signatureStatus: result.signatureStatus || 'pending',
    signatureLabel: getSignatureLabel(result.signatureStatus),
    issuerStatus: result.issuerStatus || 'unknown',
    issuerLabel: getIssuerLabel(result.issuerStatus),
    canImport: result.signatureStatus !== 'invalid'
  };
}

function buildCoffeeQrRecognitionPayload(result = {}, rawText = '') {
  const preview = buildPreview(result);
  if (!preview.canImport) {
    throw new Error('签名验证失败，已停止自动入库');
  }

  const bean = buildBeanFromDecoded(result);
  const draft = BEAN_DRAFT_FIELDS.reduce((value, field) => {
    value[field] = bean[field];
    return value;
  }, {});
  const metadata = Object.keys(bean).reduce((value, field) => {
    if (field.startsWith('qr')) value[field] = bean[field];
    return value;
  }, {});
  const warnings = [];
  if (result.signatureStatus !== 'verified') {
    warnings.push('二维码来源尚未完成签名验证，请保存前核对豆子信息。');
  }
  if (result.issuerStatus === 'revoked') {
    warnings.push('二维码发行方已撤销，请谨慎核对后再保存。');
  }

  return {
    source: 'COF 二维码',
    status: result.signatureStatus === 'verified' ? '校验通过，请确认' : '已识别，请核对',
    draft,
    candidates: {},
    rawText: String(rawText || ''),
    warnings,
    metadata
  };
}

function findCoffeeQrDuplicate(beans = [], metadata = {}) {
  if (!metadata.qrIssuerId || !metadata.qrBatchId) return null;
  const bean = beans.find(item => (
    item.qrIssuerId === metadata.qrIssuerId
    && item.qrBatchId === metadata.qrBatchId
  ));
  if (!bean) return null;
  return {
    bean,
    type: bean.qrPayloadHash === metadata.qrPayloadHash ? 'same' : 'conflict'
  };
}

function mapProcessing(processes = []) {
  const codes = processes.map(item => item.code);
  const names = processes.map(displayName).join(' ');
  if (codes.includes('PR-WA')) return 'washed';
  if (codes.includes('PR-NA')) return 'natural';
  if (codes.some(code => /^PR-(HO|YH|RH|BH)$/.test(code)) || names.includes('蜜')) return 'honey';
  return 'other';
}

function mapRoastLevel(value) {
  return ({
    extremely_light: 'ultra_light',
    light: 'light',
    medium_light: 'light',
    medium: 'medium',
    medium_dark: 'dark',
    dark: 'ultra_dark'
  })[value] || 'light';
}

function getRoastLevelText(value) {
  return ({
    extremely_light: '极浅烘',
    light: '浅烘',
    medium_light: '中浅烘',
    medium: '中烘',
    medium_dark: '中深烘',
    dark: '深烘'
  })[value] || value || '未填写';
}

function getSignatureLabel(value) {
  if (value === 'verified') return '签名有效';
  if (value === 'invalid') return '签名无效';
  return '来源待验证';
}

function getIssuerLabel(value) {
  if (value === 'authenticated') return '发行方已认证';
  if (value === 'registered') return '发行方已登记';
  if (value === 'revoked') return '发行方已撤销';
  return '发行方未知';
}

function normalizeStock(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : '';
}

function formatAltitude(minValue, maxValue) {
  const min = Number(minValue);
  const max = Number(maxValue);
  const hasMin = Number.isFinite(min);
  const hasMax = Number.isFinite(max);
  if (hasMin && hasMax) return min === max ? `${min}m` : `${min}-${max}m`;
  if (hasMin) return `${min}m`;
  if (hasMax) return `${max}m`;
  return '';
}

function displayName(entity = {}) {
  return entity.nameCn || entity.shortName || entity.nameEn || entity.code || '';
}

module.exports = {
  API_BASE_URL_STORAGE_KEY,
  DEFAULT_API_BASE_URL,
  buildBeanFromDecoded,
  buildCoffeeQrRecognitionPayload,
  buildPreview,
  findCoffeeQrDuplicate,
  getApiBaseUrl,
  getShortBatchApiUrl,
  requestCoffeeQrApi,
  requestCoffeeQrUrl
};
