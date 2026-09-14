import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, t } from '../public/i18n.js';
import { NATIVE_PAGES, nativeUrl } from '../public/native-pages.js';

test('Companion ships complete French, English and Simplified Chinese locales', () => {
  assert.deepEqual(Object.keys(LOCALES).sort(), ['en', 'fr', 'zh-CN']);
  for (const locale of Object.keys(LOCALES)) {
    assert.equal(typeof t(locale, 'brand.tagline'), 'string');
    assert.notEqual(t(locale, 'brand.tagline'), 'brand.tagline');
    assert.equal(typeof t(locale, 'guide.step.cameras.title'), 'string');
    assert.equal(typeof t(locale, 'director.mode.auto'), 'string');
  }
});

test('native LinkPi actions point to actual firmware PHP pages', () => {
  assert.deepEqual(NATIVE_PAGES, {
    dashboard: 'dashboard.php', input: 'input.php', encode: 'encode.php',
    stream: 'stream.php', push: 'push.php', record: 'record.php',
    carousel: 'carousel.php', mix: 'mix.php', storage: 'storage.php',
  });
  assert.equal(nativeUrl('http://192.0.2.10/', 'input'), 'http://192.0.2.10/input.php');
  assert.equal(nativeUrl('http://192.0.2.10', 'push'), 'http://192.0.2.10/push.php');
  assert.throws(() => nativeUrl('http://192.0.2.10', 'nope'), /Unknown native page/);
});
