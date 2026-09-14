import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../public/', import.meta.url);

test('settings UI explains every editorial control and presets', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /Guide rapide/);
  assert.match(html, /Stable.*moins de cuts/s);
  assert.match(html, /Naturel.*recommandé/s);
  assert.match(html, /Réactif.*échanges rapides/s);
  for (const key of ['acquisitionMs','minShotMs','refractoryMs','overlapMs','splitHoldMs','silenceMs','speechThresholdA','speechThresholdB','dominanceMargin']) {
    assert.match(html, new RegExp(`data-help-for="${key}"`));
  }
});

test('settings UI gives tuning direction and recommended values', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /Plus haut = moins de va-et-vient/);
  assert.match(html, /Plus haut = plus stable/);
  assert.match(html, /Plus bas = plus sensible au bruit/);
  assert.match(html, /Recommandé[^<]*900 ms/);
});
