import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoDirectorRuntime } from '../src/director-runtime.js';

function readyConfig() {
  return {
    detectors: {
      a: { channelId: 0, side: 'L' },
      b: { channelId: 1, side: 'L' },
    },
    calibration: {
      a: { noiseFloor: 0, speechReference: 100 },
      b: { noiseFloor: 0, speechReference: 100 },
    },
    videoSources: { a: 0, b: 1 },
    scenesReady: true,
  };
}

function fakeRpc({ volumes = [{ L: 90, R: 0 }, { L: 5, R: 0 }] } = {}) {
  return {
    async call(method) {
      if (method === 'enc.getVolume') return volumes;
      if (method === 'enc.getInputState') return [
        { chnId: 0, avalible: true, protocol: 'HDMI' },
        { chnId: 1, avalible: true, protocol: 'UVC' },
      ];
      if (method === 'enc.getSysState') return { cpu: 20, mem: 40, temperature: 47 };
      if (method === 'carousel.getState') return { hadCarousel: false, activeMode: '' };
      throw new Error(`unexpected RPC ${method}`);
    },
  };
}

function fakeSceneController() {
  const calls = [];
  return {
    calls,
    async apply(scene) { calls.push(scene); },
  };
}

test('blocks AUTO when readiness requirements are missing', async () => {
  const runtime = new AutoDirectorRuntime({
    rpc: fakeRpc(),
    sceneController: fakeSceneController(),
    config: {},
  });
  await runtime.pollOnce(0);
  await assert.rejects(() => runtime.setMode('AUTO'), /AUTO blocked/);
  assert.equal(runtime.snapshot().mode, 'OFF');
  assert.equal(runtime.snapshot().readiness.autoReady, false);
});

test('DRY_RUN makes decisions but never mutates scenes', async () => {
  const sceneController = fakeSceneController();
  const runtime = new AutoDirectorRuntime({
    rpc: fakeRpc(), sceneController, config: readyConfig(),
  });
  await runtime.setMode('DRY_RUN');
  await runtime.pollOnce(0);
  await runtime.pollOnce(1000);
  const state = runtime.snapshot();
  assert.equal(state.lastDecision.scene, 'CAM_A');
  assert.equal(state.lastDecision.changed, true);
  assert.deepEqual(sceneController.calls, []);
});

test('AUTO applies a scene only after readiness is proven', async () => {
  const sceneController = fakeSceneController();
  const runtime = new AutoDirectorRuntime({
    rpc: fakeRpc(), sceneController, config: readyConfig(),
  });
  await runtime.pollOnce(0);
  assert.equal(runtime.snapshot().readiness.autoReady, true);
  await runtime.setMode('AUTO');
  await runtime.pollOnce(0);
  await runtime.pollOnce(1000);
  assert.deepEqual(sceneController.calls, ['CAM_A']);
});

test('polls volume fast but slow telemetry at one-second cadence', async () => {
  const calls = [];
  const base = fakeRpc();
  const rpc = {
    async call(method) {
      calls.push(method);
      return base.call(method);
    },
  };
  const runtime = new AutoDirectorRuntime({
    rpc, sceneController: fakeSceneController(), config: readyConfig(),
  });
  for (let now = 0; now <= 900; now += 100) await runtime.pollOnce(now);
  assert.equal(calls.filter(x => x === 'enc.getVolume').length, 10);
  assert.equal(calls.filter(x => x === 'enc.getInputState').length, 1);
  assert.equal(calls.filter(x => x === 'enc.getSysState').length, 1);
  assert.equal(calls.filter(x => x === 'carousel.getState').length, 1);
});

test('SAFE_SPLIT forces the split scene only when scenes are ready', async () => {
  const applied = [];
  const rpc = fakeRpc();
  const sceneController = { apply: async scene => applied.push(scene) };
  const runtime = new AutoDirectorRuntime({
    rpc, sceneController,
    config: { ...readyConfig(), scenesReady: true },
  });
  await runtime.pollOnce(0);
  await runtime.setMode('SAFE_SPLIT');
  assert.deepEqual(applied, ['SPLIT']);
  assert.equal(runtime.snapshot().mode, 'SAFE_SPLIT');
});

test('snapshot always exposes the current editorial scene', () => {
  const runtime = new AutoDirectorRuntime({
    rpc: fakeRpc(),
    sceneController: fakeSceneController(),
    config: {},
  });
  assert.equal(runtime.snapshot().scene, 'SPLIT');
});

test('updates editorial settings live and exposes them in state', () => {
  const runtime = new AutoDirectorRuntime({
    rpc: fakeRpc(), sceneController: fakeSceneController(), config: readyConfig(),
  });
  const before = runtime.snapshot().editorialSettings;
  const updated = runtime.updateEditorialSettings({ ...before, acquisitionMs: 650 });
  assert.equal(updated.acquisitionMs, 650);
  assert.equal(runtime.snapshot().editorialSettings.acquisitionMs, 650);
});

test('applies named editorial presets and rejects unknown presets', () => {
  const runtime = new AutoDirectorRuntime({
    rpc: fakeRpc(), sceneController: fakeSceneController(), config: readyConfig(),
  });
  const stable = runtime.applyEditorialPreset('STABLE');
  assert.equal(stable.acquisitionMs, 1200);
  assert.throws(() => runtime.applyEditorialPreset('TURBO'), /Unknown preset/);
});