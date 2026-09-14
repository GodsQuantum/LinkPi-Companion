export const EDITORIAL_LIMITS = Object.freeze({
  acquisitionMs: [200, 3000],
  minShotMs: [1500, 30000],
  refractoryMs: [500, 10000],
  overlapMs: [300, 5000],
  splitHoldMs: [1000, 15000],
  silenceMs: [2000, 60000],
  speechThresholdA: [0.05, 0.95],
  speechThresholdB: [0.05, 0.95],
  dominanceMargin: [0.02, 0.8],
});

export const DEFAULT_EDITORIAL_SETTINGS = Object.freeze({
  acquisitionMs: 900,
  minShotMs: 5000,
  refractoryMs: 2500,
  overlapMs: 1000,
  splitHoldMs: 3000,
  silenceMs: 7000,
  speechThresholdA: 0.35,
  speechThresholdB: 0.35,
  dominanceMargin: 0.15,
});
export const EDITORIAL_PRESETS = Object.freeze({
  STABLE: Object.freeze({
    acquisitionMs: 1200, minShotMs: 7000, refractoryMs: 3500,
    overlapMs: 1200, splitHoldMs: 4500, silenceMs: 9000,
    speechThresholdA: 0.40, speechThresholdB: 0.40, dominanceMargin: 0.20,
  }),
  NATURAL: DEFAULT_EDITORIAL_SETTINGS,
  REACTIVE: Object.freeze({
    acquisitionMs: 600, minShotMs: 3500, refractoryMs: 1500,
    overlapMs: 700, splitHoldMs: 2000, silenceMs: 5000,
    speechThresholdA: 0.30, speechThresholdB: 0.30, dominanceMargin: 0.10,
  }),
});

export function validateEditorialSettings(candidate) {
  const normalized = {};
  for (const [key, [min, max]] of Object.entries(EDITORIAL_LIMITS)) {
    const value = Number(candidate?.[key]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${key} must be between ${min} and ${max}`);
    }
    normalized[key] = value;
  }
  return Object.freeze(normalized);
}