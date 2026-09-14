import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoDirectorCore } from '../src/director-core.js';

function feed(core, from, to, step, levels) {
  let decision;
  for (let now = from; now <= to; now += step) {
    decision = core.update({ now, ...levels });
  }
  return decision;
}

test('acquires a sustained speaker before cutting from split', () => {
  const core = new AutoDirectorCore();
  assert.equal(core.scene, 'SPLIT');

  feed(core, 0, 800, 100, { a: 0.9, b: 0.05 });
  assert.equal(core.scene, 'SPLIT');

  const decision = core.update({ now: 900, a: 0.9, b: 0.05 });
  assert.equal(decision.scene, 'CAM_A');
  assert.equal(decision.changed, true);
});

test('does not leave a single-camera shot before the minimum hold', () => {
  const core = new AutoDirectorCore();
  feed(core, 0, 900, 100, { a: 0.9, b: 0.05 });
  assert.equal(core.scene, 'CAM_A');

  feed(core, 1000, 5800, 100, { a: 0.05, b: 0.9 });
  assert.equal(core.scene, 'CAM_A');

  const decision = core.update({ now: 5900, a: 0.05, b: 0.9 });
  assert.equal(decision.scene, 'CAM_B');
  assert.equal(decision.changed, true);
});

test('moves to split after sustained overlap', () => {
  const core = new AutoDirectorCore();
  feed(core, 0, 900, 100, { a: 0.9, b: 0.05 });
  feed(core, 1000, 6000, 100, { a: 0.9, b: 0.05 });
  assert.equal(core.scene, 'CAM_A');

  feed(core, 6100, 7000, 100, { a: 0.8, b: 0.8 });
  assert.equal(core.scene, 'CAM_A');

  const decision = core.update({ now: 7100, a: 0.8, b: 0.8 });
  assert.equal(decision.scene, 'SPLIT');
  assert.equal(decision.reason, 'sustained-overlap');
});

test('holds split after overlap before returning to one speaker', () => {
  const core = new AutoDirectorCore();
  feed(core, 0, 900, 100, { a: 0.9, b: 0.05 });
  feed(core, 1000, 6000, 100, { a: 0.9, b: 0.05 });
  feed(core, 6100, 7100, 100, { a: 0.8, b: 0.8 });
  assert.equal(core.scene, 'SPLIT');

  feed(core, 7200, 10000, 100, { a: 0.05, b: 0.9 });
  assert.equal(core.scene, 'SPLIT');

  const decision = core.update({ now: 10100, a: 0.05, b: 0.9 });
  assert.equal(decision.scene, 'CAM_B');
});

test('uses split as a neutral reset after long silence', () => {
  const core = new AutoDirectorCore();
  feed(core, 0, 900, 100, { a: 0.9, b: 0.05 });
  feed(core, 1000, 6000, 100, { a: 0.9, b: 0.05 });
  assert.equal(core.scene, 'CAM_A');

  feed(core, 6100, 13000, 100, { a: 0.05, b: 0.05 });
  assert.equal(core.scene, 'CAM_A');

  const decision = core.update({ now: 13100, a: 0.05, b: 0.05 });
  assert.equal(decision.scene, 'SPLIT');
  assert.equal(decision.reason, 'long-silence');
});

test('applies hot editorial settings without resetting the current scene', () => {
  const core = new AutoDirectorCore();
  feed(core, 0, 900, 100, { a: 0.9, b: 0.05 });
  assert.equal(core.scene, 'CAM_A');
  core.setConfig({
    ...core.config,
    acquisitionMs: 300,
    speechThresholdA: 0.35,
    speechThresholdB: 0.35,
  });
  assert.equal(core.scene, 'CAM_A');
  feed(core, 6000, 6200, 100, { a: 0.05, b: 0.9 });
  assert.equal(core.scene, 'CAM_A');
  const decision = core.update({ now: 6300, a: 0.05, b: 0.9 });
  assert.equal(decision.scene, 'CAM_B');
});