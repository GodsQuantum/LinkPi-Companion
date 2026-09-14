import { DEFAULT_EDITORIAL_SETTINGS, validateEditorialSettings } from './settings.js';

export const DEFAULTS = DEFAULT_EDITORIAL_SETTINGS;

export class AutoDirectorCore {
  constructor(config = {}) {
    this.config = validateEditorialSettings({ ...DEFAULTS, ...config });
    this.scene = 'SPLIT';
    this.sceneSince = 0;
    this.lastCutAt = Number.NEGATIVE_INFINITY;
    this.candidate = null;
    this.candidateSince = null;
    this.overlapSince = null;
    this.silenceSince = null;
    this.splitHoldUntil = 0;
  }

  setConfig(config) {
    this.config = validateEditorialSettings(config);
    return this.config;
  }

  update({ now, a, b }) {
    if (this.#bothActive(a, b)) {
      this.#clearCandidate();
      if (this.overlapSince === null) this.overlapSince = now;
      return this.#handleOverlap(now);
    }
    this.overlapSince = null;
    if (this.#bothQuiet(a, b)) {
      this.#clearCandidate();
      if (this.silenceSince === null) this.silenceSince = now;
      if (this.scene !== 'SPLIT' &&
          now - this.silenceSince >= this.config.silenceMs && this.#canCut(now)) {
        return this.#cut('SPLIT', now, 'long-silence');
      }
      return this.#result(false, 'silence-hold');
    }
    this.silenceSince = null;
    const target = this.#singleSpeakerTarget(a, b);
    if (!target || target === this.scene) {
      this.#clearCandidate();
      return this.#result(false, 'hold');
    }

    if (this.candidate !== target) {
      this.candidate = target;
      this.candidateSince = now;
    }
    if (now - this.candidateSince < this.config.acquisitionMs) {
      return this.#result(false, 'acquiring');
    }
    if (!this.#canCut(now)) {
      return this.#result(false, 'hold-min-shot');
    }

    return this.#cut(target, now, 'speaker-acquired');
  }

  #handleOverlap(now) {
    if (this.scene === 'SPLIT') return this.#result(false, 'overlap-split');
    if (now - this.overlapSince < this.config.overlapMs) {
      return this.#result(false, 'overlap-pending');
    }
    if (!this.#canCut(now)) return this.#result(false, 'hold-min-shot');
    return this.#cut('SPLIT', now, 'sustained-overlap');
  }
  #bothActive(a, b) {
    return a >= this.config.speechThresholdA && b >= this.config.speechThresholdB;
  }

  #bothQuiet(a, b) {
    return a < this.config.speechThresholdA && b < this.config.speechThresholdB;
  }

  #canCut(now) {
    if (now - this.lastCutAt < this.config.refractoryMs) return false;
    if (this.scene === 'SPLIT' && now < this.splitHoldUntil) return false;
    if (this.scene !== 'SPLIT' &&
        now - this.sceneSince < this.config.minShotMs) return false;
    return true;
  }

  #cut(scene, now, reason) {
    if (scene === 'SPLIT' && reason === 'sustained-overlap') {
      this.splitHoldUntil = now + this.config.splitHoldMs;
    } else if (scene !== 'SPLIT') {
      this.splitHoldUntil = 0;
    }
    this.scene = scene;
    this.sceneSince = now;
    this.lastCutAt = now;
    this.#clearCandidate();
    return this.#result(true, reason);
  }

  #singleSpeakerTarget(a, b) {
    const { speechThresholdA, speechThresholdB, dominanceMargin } = this.config;
    if (a >= speechThresholdA && a - b >= dominanceMargin) return 'CAM_A';
    if (b >= speechThresholdB && b - a >= dominanceMargin) return 'CAM_B';
    return null;
  }
  #clearCandidate() {
    this.candidate = null;
    this.candidateSince = null;
  }

  #result(changed, reason) {
    return {
      scene: this.scene,
      changed,
      reason,
      candidate: this.candidate,
    };
  }
}
