import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import QRCode from 'qrcode';

import { decodeCoffeeQr, encodeCoffeeQr } from '../src/codec.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'output');
const batch = JSON.parse(await fs.readFile(path.join(root, 'examples', 'sample-batch.json'), 'utf8'));
const privateKey = await fs.readFile(path.join(root, 'fixtures', 'demo-private-key.pem'), 'utf8');
const publicKey = await fs.readFile(path.join(root, 'fixtures', 'demo-public-key.pem'), 'utf8');

await fs.mkdir(outputDir, { recursive: true });

const encoded = await encodeCoffeeQr(batch, { privateKey });
const decoded = await decodeCoffeeQr(encoded.text, { publicKey });
const qrPath = path.join(outputDir, 'sample-coffee-qr.png');
const qrSvgPath = path.join(outputDir, 'sample-coffee-qr.svg');
const vectorPath = path.join(outputDir, 'sample-vector.json');
const qrModel = QRCode.create(encoded.text, { errorCorrectionLevel: 'M' });

await QRCode.toFile(qrPath, encoded.text, {
  errorCorrectionLevel: 'M',
  margin: 4,
  width: 1024,
  color: { dark: '#111111', light: '#FFFFFF' }
});

await QRCode.toFile(qrSvgPath, encoded.text, {
  errorCorrectionLevel: 'M',
  margin: 4,
  type: 'svg',
  color: { dark: '#111111', light: '#FFFFFF' }
});

await fs.writeFile(vectorPath, `${JSON.stringify({
  source: batch,
  qrText: encoded.text,
  qrTextLength: encoded.text.length,
  qrVersion: qrModel.version,
  moduleCount: qrModel.modules.size,
  payloadHex: encoded.payload.toString('hex'),
  coseHex: encoded.cose.toString('hex'),
  expected: {
    signatureStatus: decoded.signatureStatus,
    batch: decoded.batch
  }
}, null, 2)}\n`, 'utf8');

console.log(`QR text length: ${encoded.text.length}`);
console.log(`QR version: ${qrModel.version} (${qrModel.modules.size} modules)`);
console.log(`QR image: ${qrPath}`);
console.log(`QR vector: ${qrSvgPath}`);
console.log(`Test vector: ${vectorPath}`);
