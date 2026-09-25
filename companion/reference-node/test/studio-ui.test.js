import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const studio = await readFile(new URL('../public/studio.js', import.meta.url), 'utf8');
const js = app + '\n' + studio;

test('Studio is a first-class simple control view', () => {
  assert.match(html, /data-nav-target="studio"/);
  assert.match(html, /data-view="studio"/);
  for (const id of ['studioStartStream','studioStopStream','studioStartRecord','studioStopRecord','studioSource','studioResolution','studioFps','studioCodec']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('Studio exposes LinkPi native resolutions and practical frame rates', () => {
  for (const value of ['3840x2160','1920x1080','1280x720','640x360','1080x1920','720x1280','360x640']) {
    assert.match(html, new RegExp(`value="${value}"`));
  }
  for (const fps of ['60','50','30','25','24']) assert.match(html, new RegExp(`value="${fps}"`));
  assert.match(html, /value="h264"/);
  assert.match(html, /value="h265"/);
});

test('Studio supports provider presets and network guests', () => {
  for (const p of ['youtube','twitch','restream']) assert.match(html, new RegExp(`data-studio-provider="${p}"`));
  assert.match(html, /id="studioGuestUrl"/);
  assert.match(html, /id="studioGuestSlot"/);
  assert.match(html, /VDO\.Ninja/i);
  assert.match(js, /import '.\/studio\.js'/);
  assert.match(studio, /\/api\/studio\/state/);
  assert.match(studio, /\/api\/studio\/stream\/start/);
  assert.match(studio, /\/api\/studio\/record\/start/);
  assert.match(studio, /\/api\/studio\/network/);
  assert.match(html, /data-studio-provider="remoteobs"/);
  assert.match(studio, /remoteobs\/preview/);
});

test('shell routes to Studio and loads Studio controller', () => {
  assert.match(js, /\['guide', 'studio', 'director', 'status'\]/);
  assert.match(html, /<script type="module" src="\/studio\.js"><\/script>/);
});

test('UVC firmware quirk is handled from real UVC enumeration', async () => {
  const php = await readFile(new URL('../../embedded/studio.php', import.meta.url), 'utf8');
  assert.match(php, /enc\.getUvcInfo/);
  assert.match(php, /uvcEnumerated/);
  assert.match(php, /glob\('\/dev\/video\*'\)/);
});
