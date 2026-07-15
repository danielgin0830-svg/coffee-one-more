import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import QRCode from 'qrcode';

import { decodeCoffeeQr, encodeCoffeeQr } from '../src/codec.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(await fs.readFile(path.join(root, 'examples', 'sample-batch.json'), 'utf8'));
const privateKey = await fs.readFile(path.join(root, 'fixtures', 'demo-private-key.pem'), 'utf8');
const publicKey = await fs.readFile(path.join(root, 'fixtures', 'demo-public-key.pem'), 'utf8');

test('generated PNG can be scanned back into a verified coffee batch', async () => {
  const encoded = await encodeCoffeeQr(batch, { privateKey });
  const pngBuffer = await QRCode.toBuffer(encoded.text, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 1024
  });
  const png = PNG.sync.read(pngBuffer);
  const scanned = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

  assert.ok(scanned, 'QR reader did not find the generated code');
  assert.equal(scanned.data, encoded.text);

  const decoded = await decodeCoffeeQr(scanned.data, { publicKey });
  assert.equal(decoded.signatureStatus, 'verified');
  assert.equal(decoded.batch.batchId, batch.batchId);
});
