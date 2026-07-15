import { createHash, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import QRCode from 'qrcode';

import { decodeCoffeeQr, encodeCoffeeQr } from './src/codec.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(root, 'public');
const port = Number(process.env.PORT || 3210);
const host = process.env.HOST || '0.0.0.0';
const shareToken = String(process.env.SHARE_TOKEN || '').trim();
const persistBatches = process.env.PERSIST_BATCHES !== 'false';
const batchStorePath = path.join(root, '.runtime', 'batches.json');
const maxBodyBytes = 1024 * 1024;

const registry = JSON.parse(await fs.readFile(
  path.join(root, 'registry', 'coffee-origin-registry-2026.07.1.json'),
  'utf8'
));
const privateKey = await fs.readFile(path.join(root, 'fixtures', 'demo-private-key.pem'), 'utf8');
const publicKey = await fs.readFile(path.join(root, 'fixtures', 'demo-public-key.pem'), 'utf8');
const sampleBatch = JSON.parse(await fs.readFile(path.join(root, 'examples', 'sample-batch.json'), 'utf8'));

const entityById = new Map(registry.entities.map(item => [item.qrId, item]));
const catalog = buildCatalog(registry);
const batchStore = await loadBatchStore();
let latestIssue = await issueBatch(sampleBatch, `http://127.0.0.1:${port}`);

const server = http.createServer(async (request, response) => {
  setCors(response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${port}`}`);

    if (shareToken && !isPublicBatchPath(url.pathname) && !authorizeShareRequest(request, response, url)) {
      return;
    }

    const publicBatchCode = matchPublicBatchCode(url.pathname);
    if (request.method === 'GET' && publicBatchCode) {
      const decoded = await getStoredBatch(publicBatchCode);
      return sendBatchPage(response, decoded);
    }

    const publicApiCode = matchPublicBatchApiCode(url.pathname);
    if (request.method === 'GET' && publicApiCode) {
      return sendJson(response, 200, await getStoredBatch(publicApiCode));
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(response, 200, {
        ok: true,
        service: 'coffee-open-format-local-mvp',
        registryVersion: registry.registryVersion,
        registryHash: registry.registryHash
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/catalog') {
      return sendJson(response, 200, catalog);
    }

    if (request.method === 'GET' && url.pathname === '/api/latest') {
      return sendJson(response, 200, latestIssue);
    }

    if (request.method === 'POST' && url.pathname === '/api/encode') {
      const input = await readJson(request);
      latestIssue = await issueBatch(buildIssuedBatch(input), getPublicOrigin(request));
      return sendJson(response, 201, latestIssue);
    }

    if (request.method === 'POST' && url.pathname === '/api/decode') {
      const input = await readJson(request);
      if (!input.qrText) throw new HttpError(400, 'qrText is required');
      const decoded = await decodeQrInput(input.qrText);
      return sendJson(response, 200, decoded);
    }

    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      return await serveStatic(url.pathname, response);
    }

    throw new HttpError(404, 'Not found');
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error(error);
    sendJson(response, status, {
      ok: false,
      message: status >= 500 ? 'Local issuer service failed' : error.message
    });
  }
});

server.listen(port, host, () => {
  console.log(`Coffee QR local MVP: http://127.0.0.1:${port}`);
});

function buildIssuedBatch(input = {}) {
  const issuerName = String(input.issuerName || '').trim() || '本地测试烘焙商';
  const batchId = String(input.batchId || '').trim() || createBatchId();
  return {
    ...input,
    protocolVersion: 1,
    profileId: 'single-origin-v1',
    registryId: registry.registryId,
    registryVersion: registry.registryVersion,
    registryHash: registry.registryHash,
    issuerId: 'local-demo-roaster',
    issuerName,
    keyId: 'demo-key-1',
    batchId,
    issuedAt: new Date().toISOString(),
    entityRoles: Array.isArray(input.entityRoles) ? input.entityRoles : [],
    varietyQrIds: toIntegerArray(input.varietyQrIds),
    processQrIds: toIntegerArray(input.processQrIds),
    flavorTagQrIds: toIntegerArray(input.flavorTagQrIds),
    customFields: input.customFields || {}
  };
}

async function issueBatch(batch, publicOrigin) {
  const encoded = await encodeCoffeeQr(batch, { privateKey });
  const decoded = await decodeAndResolve(encoded.text);
  const shortCode = createShortCode(encoded.cose);
  const qrText = `${String(publicOrigin).replace(/\/$/, '')}/b/${shortCode}`;
  batchStore.set(shortCode, {
    archiveText: encoded.text,
    batchId: decoded.batch.batchId,
    payloadHash: decoded.payloadHash,
    updatedAt: new Date().toISOString()
  });
  await saveBatchStore();

  const qrModel = QRCode.create(qrText, { errorCorrectionLevel: 'M' });
  const pngDataUrl = await QRCode.toDataURL(qrText, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 1024,
    color: { dark: '#171A18', light: '#FFFFFF' }
  });
  const svg = await QRCode.toString(qrText, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4,
    color: { dark: '#171A18', light: '#FFFFFF' }
  });

  return {
    ok: true,
    qrText,
    qrTextLength: qrText.length,
    qrVersion: qrModel.version,
    moduleCount: qrModel.modules.size,
    payloadHash: sha256(encoded.payload),
    shortCode,
    archiveText: encoded.text,
    archiveTextLength: encoded.text.length,
    pngDataUrl,
    svg,
    decoded
  };
}

async function decodeQrInput(qrText) {
  if (String(qrText).startsWith('COF1:')) return decodeAndResolve(qrText);
  let url;
  try {
    url = new URL(String(qrText));
  } catch {
    throw new HttpError(400, 'unsupported coffee QR content');
  }
  const shortCode = matchPublicBatchCode(url.pathname);
  if (!shortCode) throw new HttpError(400, 'unsupported coffee QR link');
  return getStoredBatch(shortCode);
}

async function getStoredBatch(shortCode) {
  const record = batchStore.get(String(shortCode).toUpperCase());
  if (!record) throw new HttpError(404, 'coffee batch not found');
  return decodeAndResolve(record.archiveText);
}

async function decodeAndResolve(qrText) {
  const pending = await decodeCoffeeQr(qrText);
  const isDemoIssuer = pending.batch.issuerId === 'local-demo-roaster'
    && pending.batch.keyId === 'demo-key-1';
  const decoded = await decodeCoffeeQr(qrText, isDemoIssuer ? { publicKey } : {});
  const payloadHash = sha256(decoded.payload);

  return {
    ok: true,
    signatureStatus: decoded.signatureStatus,
    issuerStatus: isDemoIssuer ? 'registered' : 'unknown',
    verificationError: decoded.verificationError,
    payloadHash,
    batch: decoded.batch,
    resolved: resolveBatch(decoded.batch)
  };
}

function resolveBatch(batch) {
  return {
    country: resolveEntity(batch.countryQrId),
    entities: (batch.entityRoles || []).map(item => ({
      ...item,
      entity: item.qrId === 0
        ? { qrId: 0, code: '', nameCn: item.text, nameEn: item.text, type: item.role }
        : resolveEntity(item.qrId)
    })),
    varieties: (batch.varietyQrIds || []).map(resolveEntity),
    processes: (batch.processQrIds || []).map(resolveEntity),
    flavorTags: (batch.flavorTagQrIds || []).map(resolveEntity)
  };
}

function resolveEntity(qrId) {
  const entity = entityById.get(Number(qrId));
  if (!entity) {
    return { qrId: Number(qrId) || 0, code: '', nameCn: '', nameEn: '', type: 'unknown' };
  }
  return {
    qrId: entity.qrId,
    code: entity.code,
    type: entity.type,
    countryQrId: entity.countryQrId,
    nameCn: entity.nameCn,
    nameEn: entity.nameEn,
    shortName: entity.shortName
  };
}

function buildCatalog(source) {
  const compact = item => ({
    qrId: item.qrId,
    code: item.code,
    countryQrId: item.countryQrId,
    nameCn: item.nameCn,
    nameEn: item.nameEn,
    shortName: item.shortName
  });
  return {
    ok: true,
    registryId: source.registryId,
    registryVersion: source.registryVersion,
    registryHash: source.registryHash,
    countries: source.entities.filter(item => item.type === '国家').map(compact),
    regions: source.entities.filter(item => item.type === '产区').map(compact),
    stations: source.entities.filter(item => item.type === '庄园/农场/处理厂/水洗站').map(compact),
    varieties: source.entities.filter(item => item.type === '豆种').map(compact),
    processes: source.entities.filter(item => item.type === '处理法').map(compact),
    flavorTags: source.entities.filter(item => item.type === '风味标签').map(compact)
  };
}

async function loadBatchStore() {
  if (!persistBatches) return new Map();
  try {
    const source = JSON.parse(await fs.readFile(batchStorePath, 'utf8'));
    return new Map(Object.entries(source));
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Ignoring invalid local batch store:', error.message);
    return new Map();
  }
}

async function saveBatchStore() {
  if (!persistBatches) return;
  await fs.mkdir(path.dirname(batchStorePath), { recursive: true });
  const temporaryPath = `${batchStorePath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(Object.fromEntries(batchStore), null, 2), 'utf8');
  await fs.rename(temporaryPath, batchStorePath);
}

function getPublicOrigin(request) {
  const forwardedProtocol = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol || 'http';
  const requestHost = forwardedHost || request.headers.host || `127.0.0.1:${port}`;
  return `${protocol}://${requestHost}`;
}

function createShortCode(value) {
  return createHash('sha256').update(value).digest('base64url').slice(0, 10).toUpperCase();
}

function matchPublicBatchCode(urlPath) {
  return /^\/b\/([A-Z0-9_-]{10})$/i.exec(urlPath)?.[1]?.toUpperCase() || '';
}

function matchPublicBatchApiCode(urlPath) {
  return /^\/api\/public\/batches\/([A-Z0-9_-]{10})$/i.exec(urlPath)?.[1]?.toUpperCase() || '';
}

function isPublicBatchPath(urlPath) {
  return Boolean(matchPublicBatchCode(urlPath) || matchPublicBatchApiCode(urlPath));
}

function sendBatchPage(response, decoded) {
  const batch = decoded.batch;
  const country = decoded.resolved.country?.nameCn || decoded.resolved.country?.nameEn || '未知产地';
  const processes = decoded.resolved.processes
    .map(item => item.nameCn || item.nameEn || item.code)
    .filter(Boolean)
    .join(' / ');
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(batch.productName)}</title><style>
body{margin:0;background:#f5f1ea;color:#211f1b;font:16px/1.6 system-ui,sans-serif}.page{max-width:560px;margin:auto;padding:32px 20px}.mark{color:#a54c21;font-weight:700}.panel{margin-top:18px;padding:20px;background:#fff;border:1px solid #ded7cc;border-radius:8px}h1{font-size:26px;line-height:1.25;margin:8px 0 18px}.row{display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-top:1px solid #eee8df}.row span{color:#746c62}.row strong{text-align:right}.verified{color:#157347}</style></head>
<body><main class="page"><div class="mark">咖一杯 · 咖啡豆批次</div><section class="panel"><h1>${escapeHtml(batch.productName)}</h1>
${batchPageRow('产地', country)}${batchPageRow('处理法', processes || '未填写')}${batchPageRow('烘焙日期', batch.roastDate)}${batchPageRow('批次', batch.batchId)}${batchPageRow('发行方', batch.issuerName)}
<div class="row"><span>数字签名</span><strong class="verified">签名有效</strong></div></section></main></body></html>`;
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(html);
}

function batchPageRow(label, value) {
  return `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '未填写')}</strong></div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

async function serveStatic(urlPath, response) {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const target = path.resolve(publicRoot, `.${decodeURIComponent(requested)}`);
  if (!target.startsWith(publicRoot)) throw new HttpError(403, 'Forbidden');

  let body;
  try {
    body = await fs.readFile(target);
  } catch {
    throw new HttpError(404, 'Not found');
  }
  response.writeHead(200, { 'Content-Type': getContentType(target) });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new HttpError(413, 'Request body is too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function authorizeShareRequest(request, response, url) {
  const queryToken = url.searchParams.get('access') || '';
  if (tokensMatch(queryToken, shareToken)) {
    url.searchParams.delete('access');
    const location = `${url.pathname}${url.search}${url.hash}` || '/';
    response.writeHead(302, {
      Location: location,
      'Set-Cookie': `coffee_share=${encodeURIComponent(shareToken)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
      'Cache-Control': 'no-store'
    });
    response.end();
    return false;
  }

  const cookies = parseCookies(request.headers.cookie || '');
  if (tokensMatch(cookies.coffee_share || '', shareToken)) return true;

  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 401, { ok: false, message: 'Share access required' });
    return false;
  }

  response.writeHead(401, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end('<!doctype html><meta charset="utf-8"><title>访问链接无效</title><p>访问链接无效或已经过期，请向分享者索取新的完整链接。</p>');
  return false;
}

function parseCookies(header) {
  return header.split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator < 0) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function tokensMatch(candidate, expected) {
  const candidateBuffer = Buffer.from(String(candidate));
  const expectedBuffer = Buffer.from(String(expected));
  return candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer);
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
  })[extension] || 'application/octet-stream';
}

function toIntegerArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter(Number.isSafeInteger);
}

function createBatchId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `${date}-${String(now.getTime()).slice(-6)}`;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
