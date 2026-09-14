const SECRET_KEY = /(pass(word|wd)?|secret|token|(^|_)key$|streamkey|credential)/i;

export function sanitizeCompanionValue(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(item => sanitizeCompanionValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeCompanionValue(v, k)]));
  }
  return value;
}

export function sanitizeStreamingConfig(push = {}) {
  const destinations = Array.isArray(push.url) ? push.url : [];
  return {
    autorun: push.autorun === true,
    destinations: destinations.map(item => ({
      description: String(item?.des ?? ''),
      enabled: item?.enable === true,
      stream: String(item?.stream ?? 'main'),
      type: String(item?.type ?? 'normal'),
      videoSource: item?.srcV ?? null,
      audioSource: item?.srcA ?? null,
      protocol: typeof item?.path === 'string' ? item.path.split(':', 1)[0].toLowerCase() : '',
    })),
  };
}
