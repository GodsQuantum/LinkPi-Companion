import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHttpServer } from '../src/http-server.js';

async function withServer(runtime, fn) {
  const server = createHttpServer({ runtime, publicDir: new URL('../public/', import.meta.url) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function fakeRuntime() {
  return {
    mode: 'OFF',
    snapshot() { return { mode: this.mode, readiness: { autoReady: false } }; },
    setMode(mode) {
      if (mode === 'AUTO') throw new Error('AUTO blocked: not ready');
      this.mode = mode;
      return this.snapshot();
    },
  };
}

test('GET /api/state returns runtime state', async () => {
  await withServer(fakeRuntime(), async base => {
    const response = await fetch(`${base}/api/state`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      mode: 'OFF', readiness: { autoReady: false },
    });
  });
});

test('POST /api/mode changes safe modes', async () => {
  await withServer(fakeRuntime(), async base => {
    const response = await fetch(`${base}/api/mode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'DRY_RUN' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).mode, 'DRY_RUN');
  });
});

test('POST /api/mode rejects blocked AUTO with 409', async () => {
  await withServer(fakeRuntime(), async base => {
    const response = await fetch(`${base}/api/mode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'AUTO' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.match(body.error, /AUTO blocked/);
  });
});

test('HEAD / serves headers without a response body', async () => {
  await withServer(fakeRuntime(), async base => {
    const response = await fetch(`${base}/`, { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(await response.text(), '');
  });
});

test('GET /api/settings exposes current settings and presets', async () => {
  const runtime = fakeRuntime();
  runtime.snapshot = () => ({
    mode: runtime.mode,
    readiness: { autoReady: false },
    editorialSettings: { acquisitionMs: 900 },
  });
  await withServer(runtime, async base => {
    const response = await fetch(`${base}/api/settings`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.settings.acquisitionMs, 900);
    assert.equal(body.presets.NATURAL.acquisitionMs, 900);
  });
});

test('PUT /api/settings validates through runtime and returns updated settings', async () => {
  const runtime = fakeRuntime();
  runtime.updateEditorialSettings = settings => settings;
  await withServer(runtime, async base => {
    const response = await fetch(`${base}/api/settings`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acquisitionMs: 700 }),
    });    assert.equal(response.status, 200);
    assert.equal((await response.json()).acquisitionMs, 700);
  });
});

test('POST /api/settings/preset applies a named preset', async () => {
  const runtime = fakeRuntime();
  runtime.applyEditorialPreset = name => ({ name, acquisitionMs: 1200 });
  await withServer(runtime, async base => {
    const response = await fetch(`${base}/api/settings/preset`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'STABLE' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.name, 'STABLE');
    assert.equal(body.acquisitionMs, 1200);
  });
});
test('serves localization and native-page modules', async () => {
  await withServer(fakeRuntime(), async base => {
    for (const asset of ['/i18n.js', '/native-pages.js']) {
      const response = await fetch(`${base}${asset}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /text\/javascript/);
      assert.ok((await response.text()).length > 20);
    }
  });
});
