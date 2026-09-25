import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const studioPhp = await readFile(new URL('../../embedded/studio.php', import.meta.url), 'utf8');
const routerPhp = await readFile(new URL('../../embedded/router.php', import.meta.url), 'utf8');

test('Studio public provider state exposes booleans, never credential values', () => {
  const start = studioPhp.indexOf('function studio_public_providers');
  const end = studioPhp.indexOf('function studio_save_provider', start);
  const block = studioPhp.slice(start, end);
  assert.match(block, /keyConfigured/);
  assert.match(block, /passphraseConfigured/);
  assert.match(block, /relayPublishConfigured/);
  assert.doesNotMatch(block, /=>\s*\$p\['streamKey'\]/);
  assert.doesNotMatch(block, /=>\s*\$p\['passphrase'\]/);
  assert.doesNotMatch(block, /=>\s*\$p\['srtUrl'\]/);
  assert.doesNotMatch(block, /=>\s*\$p\['relayPublishUrl'\]/);
  assert.doesNotMatch(block, /=>\s*\$p\['relayReadUrl'\]/);
});

test('Studio mutations require non-GET methods', () => {
  assert.match(routerPhp, /GET' && \$path === '\/api\/studio\/state'/);
  for (const route of ['stream/start','stream/stop','record/start','record/stop','storage/mount','remoteobs/preview']) {
    assert.match(routerPhp, new RegExp("POST' && \\$path === '/api/studio/" + route.replace('/','\\/') + "'"));
  }
  assert.match(routerPhp, /method === 'PUT'.*studio_save_provider/s);
  assert.match(routerPhp, /method === 'PUT'.*studio_set_network_source/s);
  assert.match(routerPhp, /method === 'DELETE'.*studio_disable_network_source/s);
});

test('Studio push state never returns destination paths or URLs', () => {
  const start = studioPhp.indexOf('function studio_push_state_safe');
  const end = studioPhp.indexOf('function studio_start_stream', start);
  const block = studioPhp.slice(start, end);
  assert.match(block, /destinations/);
  assert.doesNotMatch(block, /\['path'\]/);
  const stateStart = studioPhp.indexOf('function studio_state');
  const stateEnd = studioPhp.indexOf('function studio_layout_item', stateStart);
  const stateBlock = studioPhp.slice(stateStart, stateEnd);
  assert.match(stateBlock, /studio_stream_state\(\)/);
});

test('Remote OBS converts UI milliseconds to SRT microseconds', () => {
  const start = studioPhp.indexOf('function studio_remote_obs_urls');
  const end = studioPhp.indexOf('function studio_remote_obs_preview', start);
  const block = studioPhp.slice(start, end);
  assert.ok(block.includes('$latUs=$lat*1000'));
  assert.ok(block.includes("'latency'=>$latUs"));
});

test('SRT providers use native stream2.srt instead of generic push paths', () => {
  assert.match(studioPhp, /function studio_set_native_srt/);
  assert.match(studioPhp, /['stream2']['srt']/);
  assert.match(studioPhp, /studio_provider_is_srt/);
  assert.ok(studioPhp.includes('count($srtNames)>1'));
  assert.match(studioPhp, /flvflags.*ext_header/s);
});

test('Studio validates 4K30 ceiling and applies real UVC capture mode', () => {
  assert.match(studioPhp, /ENC1 V3 supports 4K up to 30 fps/);
  assert.match(studioPhp, /function studio_uvc_modes/);
  assert.match(studioPhp, /function studio_apply_usb_capture/);
  assert.match(studioPhp, /\$ch\['capture'\]\['width'\]=\$w/);
  assert.match(studioPhp, /USB camera does not expose/);
});

test('Studio exposes explicit Auto Director prepare and calibration actions', () => {
  assert.match(routerPhp, /\/api\/studio\/autodirector\/prepare/);
  assert.match(routerPhp, /studio_prepare_autodirector/);
  assert.match(routerPhp, /\/api\/studio\/autodirector\/calibrate/);
  assert.match(routerPhp, /studio_calibrate/);
});

test('SRT network inputs follow the native LinkPi receiver/listener model', () => {
  const start = studioPhp.indexOf('function studio_set_network_source');
  const end = studioPhp.indexOf('function studio_disable_network_source', start);
  const block = studioPhp.slice(start, end);
  assert.match(block, /updateReceiverConf/);
  assert.match(block, /studio_srt_receiver_url\(\$port,\$lat,\$pass,\$streamid,'listener'\)/);
  assert.match(block, /'mode'=>'caller'/);
  assert.match(block, /publisherUrl/);
});
