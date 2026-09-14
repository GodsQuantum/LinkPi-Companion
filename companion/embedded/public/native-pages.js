export const NATIVE_PAGES = Object.freeze({
  dashboard: 'dashboard.php',
  input: 'input.php',
  encode: 'encode.php',
  stream: 'stream.php',
  push: 'push.php',
  record: 'record.php',
  carousel: 'carousel.php',
  mix: 'mix.php',
  storage: 'storage.php',
});

export function nativeUrl(baseUrl, page) {
  const path = NATIVE_PAGES[page];
  if (!path) throw new Error(`Unknown native page: ${page}`);
  return `${String(baseUrl).replace(/\/$/, '')}/${path}`;
}
