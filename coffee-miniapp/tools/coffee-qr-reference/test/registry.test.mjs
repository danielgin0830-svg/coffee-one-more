import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(await fs.readFile(
  path.join(root, 'registry', 'coffee-origin-registry-2026.07.1.json'),
  'utf8'
));
const sample = JSON.parse(await fs.readFile(
  path.join(root, 'examples', 'sample-batch.json'),
  'utf8'
));

test('registry has stable unique IDs and valid references', () => {
  assert.equal(registry.entities.length, 854);
  assert.equal(registry.relationships.length, 996);
  assert.equal(registry.aliases.length, 1976);

  const ids = registry.entities.map(item => item.qrId);
  assert.deepEqual(ids, Array.from({ length: 854 }, (_, index) => index + 1));
  assert.equal(new Set(registry.entities.map(item => item.code)).size, 854);

  const idSet = new Set(ids);
  for (const item of registry.relationships) {
    assert.ok(idSet.has(item.parentQrId));
    assert.ok(idSet.has(item.childQrId));
  }
  for (const item of registry.aliases) assert.ok(idSet.has(item.qrId));
});

test('registry hash is reproducible from its immutable body', () => {
  const { registryHash, ...body } = registry;
  const hash = createHash('sha256').update(canonicalJson(body)).digest('hex');
  assert.equal(registryHash, `sha256:${hash}`);
  assert.equal(sample.registryHash, registryHash);
});

test('sample QR IDs resolve to expected entity types', () => {
  const byId = new Map(registry.entities.map(item => [item.qrId, item]));
  assert.equal(byId.get(sample.countryQrId).type, '国家');
  assert.equal(byId.get(sample.entityRoles[0].qrId).type, '产区');
  assert.ok(sample.varietyQrIds.every(id => byId.get(id).type === '豆种'));
  assert.ok(sample.processQrIds.every(id => byId.get(id).type === '处理法'));
});

function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, sortKeys(value[key])])
  );
}
