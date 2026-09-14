import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCompanionValue, sanitizeStreamingConfig } from '../src/companion-sanitize.js';

test('recursively redacts credential-shaped keys', () => {
  const value = sanitizeCompanionValue({
    user: 'demo', passwd: 'secret', nested: { token: 'abc', bitrate: 4000 },
  });
  assert.deepEqual(value, {
    user: 'demo', passwd: '[REDACTED]', nested: { token: '[REDACTED]', bitrate: 4000 },
  });
});

test('streaming sanitizer never returns push paths or secrets', () => {
  const clean = sanitizeStreamingConfig({
    autorun: false,
    url: [{ des: 'YouTube', path: 'rtmps://host/live/REAL_KEY', passwd: 'pw', enable: true, stream: 'main' }],
  });
  assert.equal(clean.autorun, false);
  assert.equal(clean.destinations[0].description, 'YouTube');
  assert.equal(clean.destinations[0].enabled, true);
  assert.equal(clean.destinations[0].stream, 'main');
  assert.equal(JSON.stringify(clean).includes('REAL_KEY'), false);
  assert.equal(JSON.stringify(clean).includes('pw'), false);
});

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('embedded router exposes read-only Companion endpoints', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const router = await readFile(path.resolve(here, '../../embedded/router.php'), 'utf8');
  for (const route of ['summary', 'channels', 'recording', 'streaming']) {
    assert.match(router, new RegExp(`GET.*?/api/companion/${route}`));
  }
  assert.doesNotMatch(router, /(?:POST|PUT|DELETE).*?\/api\/companion\//);
});
