import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { decodeCoffeeQr, encodeCoffeeQr } from '../src/codec.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(await fs.readFile(path.join(root, 'examples', 'sample-batch.json'), 'utf8'));
const privateKey = await fs.readFile(path.join(root, 'fixtures', 'demo-private-key.pem'), 'utf8');
const publicKey = await fs.readFile(path.join(root, 'fixtures', 'demo-public-key.pem'), 'utf8');

test('signed QR round-trips with verified status', async () => {
  const encoded = await encodeCoffeeQr(batch, { privateKey });
  const decoded = await decodeCoffeeQr(encoded.text, { publicKey });

  assert.equal(decoded.signatureStatus, 'verified');
  assert.equal(decoded.batch.productName, batch.productName);
  assert.equal(decoded.batch.flavorNotes, batch.flavorNotes);
  assert.deepEqual(decoded.batch.entityRoles, batch.entityRoles);
  assert.equal(decoded.unknownFields.size, 0);
});

test('offline decode returns pending without losing batch data', async () => {
  const encoded = await encodeCoffeeQr(batch, { privateKey });
  const decoded = await decodeCoffeeQr(encoded.text);

  assert.equal(decoded.signatureStatus, 'pending');
  assert.equal(decoded.batch.batchId, batch.batchId);
});

test('wrong public key returns invalid status', async () => {
  const encoded = await encodeCoffeeQr(batch, { privateKey });
  const wrongKey = generateKeyPairSync('ed25519').publicKey;
  const decoded = await decodeCoffeeQr(encoded.text, { publicKey: wrongKey });

  assert.equal(decoded.signatureStatus, 'invalid');
  assert.ok(decoded.verificationError);
});

test('canonical payload and Ed25519 signature are deterministic', async () => {
  const first = await encodeCoffeeQr(batch, { privateKey });
  const second = await encodeCoffeeQr(structuredClone(batch), { privateKey });

  assert.equal(first.text, second.text);
});

test('rejects flavor descriptions over 60 Unicode characters', async () => {
  await assert.rejects(
    encodeCoffeeQr({ ...batch, flavorNotes: '咖'.repeat(61) }, { privateKey }),
    /flavorNotes/
  );
});

test('qr_id 0 requires fallback text and language', async () => {
  const invalidBatch = structuredClone(batch);
  invalidBatch.entityRoles[1] = { role: 'washing_station', qrId: 0 };

  await assert.rejects(
    encodeCoffeeQr(invalidBatch, { privateKey }),
    /entityRoles\[1\]\.text/
  );
});
