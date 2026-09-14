import { AutoDirectorCore } from './director-core.js';
import { EDITORIAL_PRESETS, validateEditorialSettings } from './settings.js';

const MODES = new Set(['OFF', 'DRY_RUN', 'AUTO', 'SAFE_SPLIT', 'MANUAL']);
const clamp01 = value => Math.max(0, Math.min(1, value));

export class AutoDirectorRuntime {
  constructor({ rpc, sceneController, config = {}, core = new AutoDirectorCore() }) {
    this.rpc = rpc;
    this.sceneController = sceneController;
    this.config = config;
    this.core = core;
    this.editorialSettings = validateEditorialSettings(config.editorialSettings ?? core.config);
    this.core.setConfig(this.editorialSettings);
    this.mode = 'OFF';
    this.health = { rpc: false, sceneControl: true, lastError: null, lastOkAt: null };
    this.telemetry = { volumes: [], inputs: [], system: null, carousel: null };
    this.scores = { a: null, b: null };
    this.lastDecision = null;
    this.slowPollMs = Number.isFinite(config.slowPollMs) ? config.slowPollMs : 1000;
    this.nextSlowPollAt = Number.NEGATIVE_INFINITY;
  }

  async setMode(mode) {
    if (!MODES.has(mode)) throw new Error(`Unknown mode: ${mode}`);
    if (mode === 'AUTO' && !this.#readiness().autoReady) {
      throw new Error('AUTO blocked: RPC, video, detector, calibration or scene readiness missing');
    }
    if (mode === 'SAFE_SPLIT') {
      if (!this.#readiness().scenesReady || !this.health.rpc) {
        throw new Error('SAFE_SPLIT blocked: RPC or scene readiness missing');
      }
      await this.sceneController.apply('SPLIT');
      this.health.sceneControl = true;
    }
    this.mode = mode;
    return this.snapshot();
  }

  updateEditorialSettings(settings) {
    const validated = validateEditorialSettings(settings);
    this.core.setConfig(validated);
    this.editorialSettings = validated;
    return { ...this.editorialSettings };
  }

  applyEditorialPreset(name) {
    const preset = EDITORIAL_PRESETS[name];
    if (!preset) throw new Error(`Unknown preset: ${name}`);
    return this.updateEditorialSettings(preset);
  }

  async pollOnce(now = Date.now()) {
    let telemetry;
    try {
      const volumes = await this.rpc.call('enc.getVolume');
      let { inputs, system, carousel } = this.telemetry;
      if (now >= this.nextSlowPollAt) {
        [inputs, system, carousel] = await Promise.all([
          this.rpc.call('enc.getInputState'),
          this.rpc.call('enc.getSysState'),
          this.rpc.call('carousel.getState'),
        ]);
        this.nextSlowPollAt = now + this.slowPollMs;
      }
      telemetry = { volumes, inputs, system, carousel };
    } catch (error) {
      this.health.rpc = false;
      this.health.lastError = error.message;
      if (this.mode === 'AUTO') this.mode = 'SAFE_SPLIT';
      return this.snapshot();
    }

    this.telemetry = telemetry;
    this.health.rpc = true;
    this.health.lastError = null;
    this.health.lastOkAt = now;
    this.scores = {
      a: this.#detectorScore('a'),
      b: this.#detectorScore('b'),
    };

    const readiness = this.#readiness();
    if (!['DRY_RUN', 'AUTO'].includes(this.mode) || !readiness.detectorsReady) {
      return this.snapshot();
    }
    if (!readiness.calibrationReady || this.scores.a === null || this.scores.b === null) {
      return this.snapshot();
    }

    const decision = this.core.update({ now, a: this.scores.a, b: this.scores.b });
    this.lastDecision = decision;
    if (this.mode === 'AUTO' && decision.changed) {
      try {
        await this.sceneController.apply(decision.scene);
        this.health.sceneControl = true;
      } catch (error) {
        this.health.sceneControl = false;
        this.health.lastError = error.message;
        this.mode = 'SAFE_SPLIT';
      }
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      mode: this.mode,
      scene: this.core.scene,
      editorialSettings: { ...this.editorialSettings },
      health: { ...this.health },
      readiness: this.#readiness(),
      scores: { ...this.scores },
      lastDecision: this.lastDecision ? { ...this.lastDecision } : null,
      telemetry: this.telemetry,
    };
  }
  #detectorScore(key) {
    const detector = this.config.detectors?.[key];
    const calibration = this.config.calibration?.[key];
    if (!detector || !this.#validCalibration(calibration)) return null;
    const meter = this.telemetry.volumes?.[detector.channelId];
    if (!meter) return null;
    let raw;
    if (detector.side === 'max') raw = Math.max(Number(meter.L), Number(meter.R));
    else raw = Number(meter[detector.side ?? 'L']);
    if (!Number.isFinite(raw)) return null;
    return clamp01(
      (raw - calibration.noiseFloor) /
      (calibration.speechReference - calibration.noiseFloor),
    );
  }

  #validCalibration(item) {
    return Number.isFinite(item?.noiseFloor) &&
      Number.isFinite(item?.speechReference) &&
      item.speechReference > item.noiseFloor;
  }

  #videoReady() {
    const ids = [this.config.videoSources?.a, this.config.videoSources?.b];
    if (ids.some(id => !Number.isInteger(id))) return false;
    return ids.every(id => this.telemetry.inputs?.some(input =>
      input.chnId === id && input.avalible === true));
  }
  #readiness() {
    const detectorsConfigured = Boolean(this.config.detectors?.a && this.config.detectors?.b);
    const calibrationReady = this.#validCalibration(this.config.calibration?.a) &&
      this.#validCalibration(this.config.calibration?.b);
    const detectorSignals = detectorsConfigured &&
      this.#meterExists(this.config.detectors.a) &&
      this.#meterExists(this.config.detectors.b);
    const videoReady = this.#videoReady();
    const scenesReady = this.config.scenesReady === true;
    const autoReady = this.health.rpc && this.health.sceneControl && detectorSignals &&
      calibrationReady && videoReady && scenesReady;
    return {
      rpcReady: this.health.rpc,
      detectorsConfigured,
      detectorsReady: detectorSignals,
      calibrationReady,
      videoReady,
      scenesReady,
      autoReady,
    };
  }

  #meterExists(detector) {
    if (!detector || !Number.isInteger(detector.channelId)) return false;
    const meter = this.telemetry.volumes?.[detector.channelId];
    if (!meter) return false;
    const side = detector.side ?? 'L';
    if (side === 'max') return Number.isFinite(Number(meter.L)) && Number.isFinite(Number(meter.R));
    return Number.isFinite(Number(meter[side]));
  }
}
