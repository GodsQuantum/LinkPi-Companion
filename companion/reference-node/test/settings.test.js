import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EDITORIAL_SETTINGS,
  EDITORIAL_PRESETS,
  validateEditorialSettings,
} from '../src/settings.js';

test('natural preset matches production defaults', () => {
  assert.deepEqual(EDITORIAL_PRESETS.NATURAL, DEFAULT_EDITORIAL_SETTINGS);
});

test('validates and normalizes editable editorial settings', () => {
  const result = validateEditorialSettings({
    ...DEFAULT_EDITORIAL_SETTINGS,
    acquisitionMs: 750,
    speechThresholdA: 0.31,
    speechThresholdB: 0.42,
  });
  assert.equal(result.acquisitionMs, 750);
  assert.equal(result.speechThresholdA, 0.31);
  assert.equal(result.speechThresholdB, 0.42);
});
test('rejects unsafe timing values', () => {
  assert.throws(
    () => validateEditorialSettings({ ...DEFAULT_EDITORIAL_SETTINGS, refractoryMs: 100 }),
    /refractoryMs/,
  );
  assert.throws(
    () => validateEditorialSettings({ ...DEFAULT_EDITORIAL_SETTINGS, minShotMs: 90000 }),
    /minShotMs/,
  );
});

test('rejects unsafe threshold values', () => {
  assert.throws(
    () => validateEditorialSettings({ ...DEFAULT_EDITORIAL_SETTINGS, speechThresholdA: 1.2 }),
    /speechThresholdA/,
  );
  assert.throws(
    () => validateEditorialSettings({ ...DEFAULT_EDITORIAL_SETTINGS, dominanceMargin: 0 }),
    /dominanceMargin/,
  );
});

test('provides stable and reactive presets around natural timing', () => {
  assert.ok(EDITORIAL_PRESETS.STABLE.acquisitionMs > EDITORIAL_PRESETS.NATURAL.acquisitionMs);
  assert.ok(EDITORIAL_PRESETS.STABLE.minShotMs > EDITORIAL_PRESETS.NATURAL.minShotMs);
  assert.ok(EDITORIAL_PRESETS.REACTIVE.acquisitionMs < EDITORIAL_PRESETS.NATURAL.acquisitionMs);
  assert.ok(EDITORIAL_PRESETS.REACTIVE.refractoryMs < EDITORIAL_PRESETS.NATURAL.refractoryMs);
});