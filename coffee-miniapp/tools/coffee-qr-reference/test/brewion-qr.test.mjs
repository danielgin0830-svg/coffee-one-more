import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const CODEBOOK = require('../../../data/brewion-coffee-qr-codebook-v6.js');
const {
  crc16,
  decodeBrewIonQr,
  isBrewIonQr
} = require('../../../utils/brewion-qr.js');

test('CQ8 BrewIon payload maps into the existing bean draft', () => {
  const payload = buildPayload('CQ8');
  const result = decodeBrewIonQr(payload);

  assert.equal(isBrewIonQr(payload), true);
  assert.equal(result.metadata.qrProtocol, 'CQ8');
  assert.equal(result.metadata.qrCodebookVersion, '6');
  assert.equal(result.draft.origin, '埃塞俄比亚');
  assert.equal(result.draft.processing, 'washed');
  assert.equal(result.draft.roastLevel, 'light');
  assert.equal(result.draft.roastDate, '2026-07-14');
  assert.equal(result.draft.altitude, '1850m');
  assert.equal(result.draft.variety, 'JARC 74110');
  assert.equal(result.draft.roaster, '小王');
  assert.match(result.draft.regionLot, /耶加雪菲/);
  assert.match(result.draft.regionLot, /沃卡/);
  assert.match(result.draft.flavorNotes, /茉莉/);
  assert.match(result.draft.name, /埃塞/);
});

test('CQ7 and CQ6 legacy payloads remain readable', () => {
  const cq7 = decodeBrewIonQr(buildPayload('CQ7'));
  const cq6 = decodeBrewIonQr(buildPayload('CQ6'));

  assert.equal(cq7.metadata.qrProtocol, 'CQ7');
  assert.equal(cq7.draft.roaster, '小王');
  assert.equal(cq6.metadata.qrProtocol, 'CQ6');
  assert.equal(cq6.metadata.brewIonLegacyUid, 'legacy-001');
  assert.equal(cq6.draft.processing, 'washed');
});

test('CRC changes are rejected before any bean fields are returned', () => {
  const payload = buildPayload('CQ8');
  assert.throws(
    () => decodeBrewIonQr(`${payload.slice(0, -4)}0000`),
    /二维码校验失败/
  );
});

test('codebook version mismatches are surfaced while stable rows still map', () => {
  const result = decodeBrewIonQr(buildPayload('CQ8', '7'));
  assert.equal(result.draft.origin, '埃塞俄比亚');
  assert.match(result.warnings.join('\n'), /码表版本为 v7/);
});

test('country relationship mismatches require manual verification', () => {
  const result = decodeBrewIonQr(buildPayload('CQ8', '6', {
    country: indexCode('countries', 'CO-KE')
  }));

  assert.match(result.warnings.join('\n'), /产区与国家的编码关系不一致/);
  assert.match(result.warnings.join('\n'), /处理站\/处理厂与国家的编码关系不一致/);
});

test('a rendered BrewIon QR image scans back into the same bean draft', async () => {
  const payload = buildPayload('CQ8');
  const pngBuffer = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 640
  });
  const png = PNG.sync.read(pngBuffer);
  const scanned = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

  assert.ok(scanned, 'rendered QR image should be readable');
  assert.equal(scanned.data, payload);
  assert.equal(decodeBrewIonQr(scanned.data).draft.origin, '埃塞俄比亚');
});

function buildPayload(protocol, databaseVersion = '6', overrides = {}) {
  const values = [
    protocol,
    databaseVersion,
    indexCode('countries', 'CO-EA'),
    indexCode('regions', 'RG-EA-YIR'),
    '',
    indexCode('entities', 'ST-EA-WK'),
    indexCode('varieties', 'VA-JA10'),
    indexCode('processes', 'PR-WA'),
    '1',
    '85',
    '18.5',
    indexCode('flavors', 'FV-100'),
    protocol === 'CQ8' ? encodeURIComponent('小王') : Buffer.from('小王').toString('base64url'),
    '26195',
    '2'
  ];
  if (overrides.country) values[2] = overrides.country;
  if (protocol === 'CQ6') values.splice(2, 0, 'legacy-001');
  const delimiter = protocol === 'CQ8' ? '-' : '~';
  const core = values.join(delimiter);
  return `${core}${delimiter}${crc16(core)}`;
}

function indexCode(table, code) {
  const index = CODEBOOK[table].findIndex(row => row[0] === code) + 1;
  assert.ok(index > 0, `${code} must exist in ${table}`);
  return index.toString(36);
}
