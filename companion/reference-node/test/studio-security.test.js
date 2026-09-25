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

test('Remote OBS direct uses validated LinkPi-listener / OBS-caller SRT direction', () => {
  const start = studioPhp.indexOf('function studio_remote_obs_urls');
  const end = studioPhp.indexOf('function studio_remote_obs_preview', start);
  const block = studioPhp.slice(start, end);
  assert.ok(block.includes('$latUs=$lat*1000'));
  assert.match(block, /'mode'=>'listener'/);
  assert.match(block, /'mode'=>'caller'/);
  assert.match(block, /transtype.*live/);
  assert.match(block, /pkt_size.*1316/);
  assert.match(block, /0\.0\.0\.0/);
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

test('incoming SRT guests use the native LinkPi SLS push/pull path on UDP 8080', () => {
  const start = studioPhp.indexOf('function studio_sls_state');
  const end = studioPhp.indexOf('function studio_disable_network_source', start);
  const block = studioPhp.slice(start, end);
  assert.match(block, /'port'=>8080/);
  assert.match(block, /\/conf\/updateServiceConf/);
  assert.match(block, /push\/live\//);
  assert.match(block, /pull\/live\//);
  assert.match(block, /studio_guest_stream_name/);
  assert.match(block, /publisherUrl/);
  assert.doesNotMatch(block, /updateReceiverConf/);
});

test('saved Remote OBS link is explicit POST-only and absent from normal Studio state', () => {
  assert.match(routerPhp, /POST' && \$path === '\/api\/studio\/remoteobs\/link'/);
  assert.match(routerPhp, /studio_remote_obs_saved_link/);
  const publicStart = studioPhp.indexOf('function studio_public_providers');
  const publicEnd = studioPhp.indexOf('function studio_save_provider', publicStart);
  const publicBlock = studioPhp.slice(publicStart, publicEnd);
  assert.doesNotMatch(publicBlock, /relayReadUrl.*=>/);
  assert.doesNotMatch(publicBlock, /passphrase.*=>\s*\$p/);
});

test('Remote OBS relay can expose a deliberate Browser Source only through explicit link action', () => {
  const publicStart = studioPhp.indexOf('function studio_public_providers');
  const publicEnd = studioPhp.indexOf('function studio_save_provider', publicStart);
  const publicBlock = studioPhp.slice(publicStart, publicEnd);
  assert.match(publicBlock, /relayWebConfigured/);
  assert.doesNotMatch(publicBlock, /=>\s*\$p\['relayWebUrl'\]/);
  const previewStart = studioPhp.indexOf('function studio_remote_obs_preview');
  const previewEnd = studioPhp.indexOf('function studio_provider_path', previewStart);
  const previewBlock = studioPhp.slice(previewStart, previewEnd);
  assert.match(previewBlock, /browserUrl/);
});

test('native SRT changes follow modern LinkPi stream.php updateDefaultConf reload path', () => {
  const start = studioPhp.indexOf('function studio_set_native_srt');
  const end = studioPhp.indexOf('function studio_stream_state', start);
  const block = studioPhp.slice(start, end);
  assert.match(block, /studio_native_func\('\/conf\/updateDefaultConf',\$config\)/);
  assert.doesNotMatch(block, /enc\.update/);
});

test('stopping native SRT and network inputs scrubs temporary destinations', () => {
  const srtStart = studioPhp.indexOf('function studio_set_native_srt');
  const srtEnd = studioPhp.indexOf('function studio_stream_state', srtStart);
  const srtBlock = studioPhp.slice(srtStart, srtEnd);
  assert.match(srtBlock, /\['ip'\]='127\.0\.0\.1'/);
  assert.match(srtBlock, /\['passwd'\]=''/);
  const netStart = studioPhp.indexOf('function studio_disable_network_source');
  const netEnd = studioPhp.indexOf('function studio_state', netStart);
  const netBlock = studioPhp.slice(netStart, netEnd);
  assert.match(netBlock, /\['name'\]='Net'\.\$slot/);
  assert.match(netBlock, /\['path'\]=''/);
  assert.match(netBlock, /foreach \(\['stream','stream2'\]/);
  assert.match(netBlock, /\['srt'\]\['enable'\]=false/);
});
