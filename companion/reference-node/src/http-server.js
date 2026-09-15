import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EDITORIAL_PRESETS } from './settings.js';

const MAX_BODY = 16 * 1024;
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/stream-builders.js', ['stream-builders.js', 'text/javascript; charset=utf-8']],
  ['/i18n.js', ['i18n.js', 'text/javascript; charset=utf-8']],
  ['/native-pages.js', ['native-pages.js', 'text/javascript; charset=utf-8']],
  ['/logo.svg', ['logo.svg', 'image/svg+xml']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

function headers(extra = {}) {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    ...extra,
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  }));
  res.end(payload);
}
async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function publicRoot(publicDir) {
  return publicDir instanceof URL ? fileURLToPath(publicDir) : publicDir;
}

export function createHttpServer({ runtime, publicDir, publicConfig = {} }) {
  const root = publicRoot(publicDir);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/state') {
        sendJson(res, 200, runtime.snapshot());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/config/public') {
        sendJson(res, 200, publicConfig);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/settings') {
        sendJson(res, 200, {
          settings: runtime.snapshot().editorialSettings,
          presets: EDITORIAL_PRESETS,
        });
        return;
      }
      if (req.method === 'PUT' && url.pathname === '/api/settings') {
        const body = await readJsonBody(req);
        sendJson(res, 200, runtime.updateEditorialSettings(body));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/settings/preset') {
        const body = await readJsonBody(req);
        sendJson(res, 200, runtime.applyEditorialPreset(body.name));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/mode') {
        const body = await readJsonBody(req);
        try {
          const state = await runtime.setMode(body.mode);
          sendJson(res, 200, state);
        } catch (error) {
          const status = error.message.startsWith('AUTO blocked') ? 409 : 400;
          sendJson(res, status, { error: error.message });
        }
        return;
      }

      if (['GET', 'HEAD'].includes(req.method) && STATIC.has(url.pathname)) {
        const [filename, contentType] = STATIC.get(url.pathname);
        const data = await readFile(path.join(root, filename));
        res.writeHead(200, headers({
          'content-type': contentType,
          'cache-control': 'no-cache',
        }));
        if (req.method === 'HEAD') res.end();
        else res.end(data);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
  });
}
