import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../public');

async function assets() {
  return {
    html: await readFile(path.join(publicDir, 'index.html'), 'utf8'),
    js: await readFile(path.join(publicDir, 'app.js'), 'utf8'),
    css: await readFile(path.join(publicDir, 'styles.css'), 'utf8'),
  };
}

test('Companion shell exposes Guide, Auto Director, Status and native LinkPi UI', async () => {
  const { html, js } = await assets();
  assert.match(html, /LinkPi Companion/);
  for (const label of ['Guide', 'Auto Director', 'État', 'UI LinkPi']) assert.match(html, new RegExp(label));
  for (const view of ['guide', 'director', 'status']) assert.match(html, new RegExp(`data-view="${view}"`));
  assert.match(js, /location\.hash/);
});

test('Guide is the simple default view and advanced details are collapsible', async () => {
  const { html } = await assets();
  assert.match(html, /Configurer mon LinkPi/);
  assert.match(html, /<details[^>]*class="[^"]*advanced/);
  assert.match(html, /data-view="guide"[^>]*class="[^"]*view-active/);
});

test('Guide has six beginner commissioning steps and resettable harmless progress', async () => {
  const { html, js } = await assets();
  for (const step of ['cameras','video-audio','autodirector','recording','streaming','preflight']) {
    assert.match(html, new RegExp(`data-guide-step="${step}"`));
  }
  assert.match(js, /linkpi-companion-guide-progress/);
  assert.match(js, /localStorage\.setItem/);
  assert.match(js, /resetGuide/);
  assert.match(js, /showGuideStep/);
  assert.doesNotMatch(js, /localStorage\.setItem\([^\n]*(youtubeKey|twitchKey|rtmpKey|srtPassphrase)/i);
});

test('Guide includes live source, channel and readiness targets', async () => {
  const { html, js } = await assets();
  assert.match(html, /Caméra A · HDMI/);
  assert.match(html, /Caméra B · USB\/UVC/);
  assert.match(html, /id="guideChannels"/);
  assert.match(html, /id="guideDirectorChecks"/);
  assert.match(js, /api\/companion\/channels/);
  assert.match(js, /api\/companion\/recording/);
});

test('streaming assistant wires builders, validation and copy without persisting secrets', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const router = await readFile(new URL('../../embedded/router.php', import.meta.url), 'utf8');
  assert.match(app, /stream-builders\.js/);
  assert.match(app, /buildRtmp/);
  assert.match(app, /buildSrt/);
  assert.match(app, /buildUdp/);
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(app, /data-copy-target/);
  assert.doesNotMatch(app, /localStorage\.(setItem|getItem)[^\n]*(youtubeKey|twitchKey|rtmpKey|srtPassphrase)/i);
  assert.match(router, /stream-builders\.js/);
});

test('preflight computes READY only from selected workflows and renders blockers', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /workflowDirector/);
  assert.match(app, /workflowRecording/);
  assert.match(app, /workflowStreaming/);
  assert.match(app, /enabledDestinationCount/);
  assert.match(app, /externalStorageConfigured|externalConfigured/);
  assert.match(app, /problemList/);
  assert.match(app, /globalReadyBadge/);
  assert.match(app, /PRÊT/);
  assert.match(app, /INCOMPLET/);
});

test('UI exposes FR EN Chinese selector and exact native LinkPi page links', async () => {
  const { html, js: app } = await assets();
  assert.match(html, /id="languageSelect"/);
  assert.match(html, /value="fr"/);
  assert.match(html, /value="en"/);
  assert.match(html, /value="zh-CN"/);
  for (const page of ['input','encode','record','storage','stream','push','carousel','mix','dashboard']) {
    assert.match(html, new RegExp(`data-native-page="${page}"`));
  }
  assert.match(app, /applyLocale/);
  assert.match(app, /linkpi-companion-language/);
  assert.match(app, /nativeUrl/);
  assert.doesNotMatch(app, /for \(const link of \$\$\('\[data-native-link\]'\)\) link\.href = config\.nativeUiUrl/);
});

test('language can be selected from URL and then persisted locally', async () => {
  const { js } = await assets();
  assert.match(js, /URLSearchParams/);
  assert.match(js, /[?&]lang|\.get\(['"]lang['"]\)/);
  assert.match(js, /LANGUAGE_STORAGE_KEY/);
});

test('brand uses a dedicated LinkPi Companion logo in the app header', async () => {
  const { html, css } = await assets();
  assert.match(html, /<img[^>]+src="\/logo\.svg"[^>]+alt="LinkPi Companion"/);
  assert.match(html, /class="brand-logo"/);
  assert.match(css, /\.brand-logo/);
});
