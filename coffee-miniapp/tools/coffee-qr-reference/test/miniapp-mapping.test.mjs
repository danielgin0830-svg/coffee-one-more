import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  buildBeanFromDecoded,
  buildCoffeeQrRecognitionPayload,
  findCoffeeQrDuplicate,
  buildPreview
} = require('../../../utils/coffee-qr-mvp.js');

const decoded = {
  signatureStatus: 'verified',
  issuerStatus: 'registered',
  payloadHash: 'sha256:test',
  batch: {
    protocolVersion: 1,
    registryVersion: '2026.07.1',
    issuerId: 'local-demo-roaster',
    issuerName: '巷口烘焙',
    batchId: 'MVP-001',
    productName: '耶加雪菲 沃卡 水洗',
    roastDate: '2026-07-12',
    roastLevel: 'light',
    netWeightG: 200,
    altitudeMinM: 1900,
    altitudeMaxM: 2100,
    flavorNotes: '白花、柠檬、黄桃和蜂蜜甜感'
  },
  resolved: {
    country: { code: 'CO-EA', nameCn: '埃塞俄比亚' },
    entities: [
      { role: 'region', entity: { code: 'RG-EA-YIR', nameCn: '耶加雪菲' } },
      { role: 'washing_station', entity: { code: 'ST-EA-WK', nameCn: '沃卡' } }
    ],
    varieties: [
      { code: 'VA-JA10', nameCn: 'JARC 74110' },
      { code: 'VA-JA12', nameCn: 'JARC 74112' }
    ],
    processes: [{ code: 'PR-WA', nameCn: '水洗' }]
  }
};

test('decoded COF batch maps to the existing bean storage model', () => {
  const bean = buildBeanFromDecoded(decoded);
  const preview = buildPreview(decoded);

  assert.equal(bean.name, '耶加雪菲 沃卡 水洗');
  assert.equal(bean.origin, '埃塞俄比亚');
  assert.equal(bean.regionLot, '耶加雪菲 · 沃卡');
  assert.equal(bean.variety, 'JARC 74110 / JARC 74112');
  assert.equal(bean.processing, 'washed');
  assert.equal(bean.stockGrams, 200);
  assert.equal(bean.qrBatchId, 'MVP-001');
  assert.equal(preview.canImport, true);
  assert.equal(preview.signatureLabel, '签名有效');
});

test('invalid signatures cannot be imported', () => {
  const preview = buildPreview({ ...decoded, signatureStatus: 'invalid' });
  assert.equal(preview.canImport, false);
  assert.throws(
    () => buildCoffeeQrRecognitionPayload({ ...decoded, signatureStatus: 'invalid' }, 'COF1:invalid'),
    /签名验证失败/
  );
});

test('decoded COF batch becomes a quick-add recognition draft', () => {
  const payload = buildCoffeeQrRecognitionPayload(decoded, 'COF1:test');

  assert.equal(payload.source, 'COF 二维码');
  assert.equal(payload.status, '校验通过，请确认');
  assert.equal(payload.draft.name, '耶加雪菲 沃卡 水洗');
  assert.equal(payload.draft.stockGrams, 200);
  assert.equal(payload.metadata.qrIssuerId, 'local-demo-roaster');
  assert.equal(payload.metadata.qrBatchId, 'MVP-001');
  assert.equal(payload.rawText, 'COF1:test');
});

test('COF duplicate detection distinguishes identical and conflicting batches', () => {
  const metadata = buildCoffeeQrRecognitionPayload(decoded).metadata;
  const existing = { ...metadata, name: '已入库豆子' };

  assert.equal(findCoffeeQrDuplicate([existing], metadata).type, 'same');
  assert.equal(findCoffeeQrDuplicate([
    { ...existing, qrPayloadHash: 'sha256:other' }
  ], metadata).type, 'conflict');
  assert.equal(findCoffeeQrDuplicate([], metadata), null);
});
