import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('missing static files do not stop the issuer service', async t => {
  const port = 32000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', PERSIST_BATCHES: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => child.kill());

  await waitForService(port, child);

  const missing = await fetch(`http://127.0.0.1:${port}/favicon.ico`);
  assert.equal(missing.status, 404);

  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const sample = await import('../examples/sample-batch.json', { with: { type: 'json' } });
  const encoded = await fetch(`http://127.0.0.1:${port}/api/encode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sample.default)
  });
  assert.equal(encoded.status, 201);
  const result = await encoded.json();
  assert.equal(result.ok, true);
  assert.match(result.qrText, new RegExp(`^http://127\\.0\\.0\\.1:${port}/b/[A-Z0-9_-]{10}$`));
  assert.match(result.archiveText, /^COF1:/);
  assert.ok(result.moduleCount < 81);
  assert.equal(result.decoded.signatureStatus, 'verified');

  const publicPage = await fetch(result.qrText);
  assert.equal(publicPage.status, 200);
  assert.match(await publicPage.text(), new RegExp(sample.default.productName));

  const decodedLink = await fetch(`http://127.0.0.1:${port}/api/decode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrText: result.qrText })
  });
  assert.equal(decodedLink.status, 200);
  assert.equal((await decodedLink.json()).signatureStatus, 'verified');
});

test('share mode requires a valid access link and keeps the session authorized', async t => {
  const port = 33000 + (process.pid % 1000);
  const token = 'test-share-token';
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', SHARE_TOKEN: token, PERSIST_BATCHES: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => child.kill());

  await waitForService(port, child, token);

  const denied = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(denied.status, 401);

  const authorized = await fetch(`http://127.0.0.1:${port}/?access=${token}`, {
    redirect: 'manual'
  });
  assert.equal(authorized.status, 302);
  assert.equal(authorized.headers.get('location'), '/');
  const cookie = authorized.headers.get('set-cookie');
  assert.match(cookie, /coffee_share=test-share-token/);

  const page = await fetch(`http://127.0.0.1:${port}/`, {
    headers: { Cookie: cookie }
  });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /生成二维码/);
});

async function waitForService(port, child, token = '') {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`issuer service exited early with code ${child.exitCode}`);
    }
    try {
      const access = token ? `?access=${encodeURIComponent(token)}` : '';
      const response = await fetch(`http://127.0.0.1:${port}/api/health${access}`, {
        redirect: 'manual'
      });
      if (response.ok) return;
      if (token && response.status === 302) return;
    } catch {
      // The child process may still be loading the registry and signing the sample.
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('issuer service did not start in time');
}
