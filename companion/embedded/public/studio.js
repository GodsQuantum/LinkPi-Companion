import { translateText, normalizeLocale } from './i18n.js';
import { applyStudioLocale, translateStudioText } from './studio-i18n.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let studioState = null;
let studioBusy = false;
const urlLanguage = new URLSearchParams(window.location.search).get('lang');
let locale = normalizeLocale(urlLanguage || localStorage.getItem('linkpi-companion-language') || navigator.language);
const tr = text => translateStudioText(locale, translateText(locale, text));

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || ('HTTP ' + response.status));
  return body;
}
function studioPayload() {
  const audio = [];
  if ($('#studioAudioHdmi').checked) audio.push(0);
  if ($('#studioAudioUsb').checked) audio.push(1);
  if ($('#studioAudioNet1').checked) audio.push(2);
  if ($('#studioAudioNet2').checked) audio.push(3);
  if ($('#studioAudioNet3').checked) audio.push(4);
  if ($('#studioAudioNet4').checked) audio.push(5);
  return {
    source: $('#studioSource').value,
    live: {
      resolution: $('#studioResolution').value,
      fps: Number($('#studioFps').value),
      codec: $('#studioCodec').value,
      bitrate: Number($('#studioBitrate').value),
      autoBitrate: $('#studioAutoBitrate').checked,
      rcmode: 'cbr',
    },
    record: {
      resolution: $('#studioRecordResolution').value,
      fps: Number($('#studioRecordFps').value),
      codec: $('#studioRecordCodec').value,
      bitrate: Number($('#studioRecordBitrate').value),
      rcmode: 'vbr',
    },
    programAudio: audio,
  };
}
function providers() {
  return $$('[data-studio-provider]:checked').map(input => input.dataset.studioProvider);
}
function recordSources() {
  if ($('#studioRecordAll').checked) return ['ALL'];
  const out = [];
  if ($('#studioRecordHdmi').checked) out.push('HDMI');
  if ($('#studioRecordUsb').checked) out.push('USB');
  if ($('#studioRecordProgram').checked) out.push('PROGRAM');
  return out.length ? out : ['AUTO'];
}
function action(message, bad = false) {
  const el = $('#studioActionStatus');
  el.textContent = tr(message);
  el.className = 'mini-badge' + (bad ? ' badge-bad' : '');
}
function isRecording(state) {
  const rows = Array.isArray(state?.recording) ? state.recording : [];
  return rows.some(row => row && row.curFileName && row.curFileName !== '------');
}
function render(state) {
  studioState = state;
  const pushing = state?.stream?.pushing === true;
  const recording = isRecording(state);
  $('#studioStreamBadge').textContent = tr(pushing ? 'STREAM EN COURS' : 'STREAM ARRÊTÉ');
  $('#studioStreamBadge').className = 'status-pill ' + (pushing ? 'status-good' : 'status-warn');
  $('#studioRecordBadge').textContent = tr(recording ? 'REC EN COURS' : 'REC ARRÊTÉ');
  $('#studioRecordBadge').className = 'status-pill ' + (recording ? 'status-good' : 'status-warn');

  const cfg = state?.config ?? {};
  if (!studioBusy) {
    if (cfg.source) $('#studioSource').value = cfg.source;
    const live = cfg.live ?? {};
    const rec = cfg.record ?? {};
    if (live.resolution) $('#studioResolution').value = live.resolution;
    if (live.fps) $('#studioFps').value = String(live.fps);
    if (live.codec) $('#studioCodec').value = live.codec;
    if (live.bitrate) $('#studioBitrate').value = live.bitrate;
    if (live.autoBitrate !== undefined) $('#studioAutoBitrate').checked = live.autoBitrate === true;
    if (rec.resolution) $('#studioRecordResolution').value = rec.resolution;
    if (rec.fps) $('#studioRecordFps').value = String(rec.fps);
    if (rec.codec) $('#studioRecordCodec').value = rec.codec;
    if (rec.bitrate) $('#studioRecordBitrate').value = rec.bitrate;
  }
  const liveInputs = (Array.isArray(state?.inputs) ? state.inputs : []).filter(x => x?.avalible === true);
  const netInputs = (Array.isArray(state?.channels) ? state.channels : []).filter(x => x?.type === 'net' && x?.enabled && x?.networkConfigured);
  const sourceCount = liveInputs.length + netInputs.length;
  $('#studioInputHint').textContent = sourceCount ? String(sourceCount) + ' ' + tr('source(s) active(s)') : tr('Aucune source');

  const layoutSelect = $('#studioLayout');
  const previousLayout = layoutSelect.value;
  layoutSelect.replaceChildren();
  const automatic = document.createElement('option'); automatic.value = ''; automatic.textContent = tr('Auto selon les sources'); layoutSelect.append(automatic);
  for (const layout of (state?.layouts ?? [])) {
    const option = document.createElement('option'); option.value = String(layout.id); option.textContent = `${layout.name} · ${layout.slots} slot(s)`; layoutSelect.append(option);
  }
  if ([...layoutSelect.options].some(o => o.value === previousLayout)) layoutSelect.value = previousLayout;

  const p = state?.providers ?? {};
  for (const input of $$('[data-studio-provider]')) {
    const item = p[input.dataset.studioProvider];
    if (item && !input.matches(':focus')) input.checked = item.enabled === true;
  }
  $('#studioProviderHint').textContent = String(providers().length) + ' ' + tr('destination(s)');

  const ad=state?.autodirector ?? {};
  $('#studioAutoBadge').textContent = ad.mode || 'OFF';
  $('#studioAutoHint').textContent = ad.readiness?.autoReady
    ? tr('AUTO est prêt.')
    : tr('AUTO reste verrouillé tant que calibration et scènes ne sont pas validées.');

  const storage = state?.storage ?? {};
  const box = $('#studioStorageSummary');
  const span = box.querySelector('span');
  span.textContent = storage.mounted
    ? tr('Monté') + ' · ' + (storage.configuredDevice || '') + ' · ' + (storage.recordRoot || '/root/usb')
    : (storage.devices?.length ? tr('Disque détecté mais non monté.') : tr('Aucun disque externe détecté.'));
  box.classList.toggle('warning', !storage.mounted);
  const mountRow = $('#studioMountRow');
  mountRow.replaceChildren();
  if (!storage.mounted && Array.isArray(storage.devices)) {
    for (const device of storage.devices) {
      const button = document.createElement('button');
      button.className = 'secondary-btn';
      button.textContent = tr('Monter') + ' ' + device;
      button.addEventListener('click', async () => {
        try {
          action('Montage du disque…');
          await request('/api/studio/storage/mount', { method: 'POST', body: JSON.stringify({ device }) });
          await loadState();
          action('Disque monté');
        } catch (error) { action(error.message, true); }
      });
      mountRow.append(button);
    }
  }
}
async function loadState() {
  try { render(await request('/api/studio/state')); }
  catch (error) { action('Studio: ' + error.message, true); }
}
$('#studioApplyLayout').addEventListener('click', async () => {
  const layoutId = $('#studioLayout').value;
  if (layoutId === '') { action('Layout automatique conservé'); return; }
  const audio = [];
  if ($('#studioAudioHdmi').checked) audio.push(0);
  if ($('#studioAudioUsb').checked) audio.push(1);
  if ($('#studioAudioNet1').checked) audio.push(2);
  if ($('#studioAudioNet2').checked) audio.push(3);
  if ($('#studioAudioNet3').checked) audio.push(4);
  if ($('#studioAudioNet4').checked) audio.push(5);
  try {
    const result = await request('/api/studio/layout', { method: 'POST', body: JSON.stringify({ layoutId: Number(layoutId), audio }) });
    action(`Layout ${result.name || layoutId} appliqué`);
    await loadState();
  } catch (error) { action(error.message, true); }
});

for (const button of $$('[data-studio-quality]')) button.addEventListener('click', () => {
  const mode = button.dataset.studioQuality;
  if (mode === 'wifi') {
    $('#studioResolution').value = '1920x1080';
    $('#studioFps').value = '30';
    $('#studioCodec').value = 'auto';
    $('#studioBitrate').value = '4500';
    $('#studioAutoBitrate').checked = true;
  } else if (mode === 'quality') {
    $('#studioResolution').value = '3840x2160';
    $('#studioFps').value = '30';
    $('#studioCodec').value = 'h265';
    $('#studioBitrate').value = '12000';
    $('#studioAutoBitrate').checked = true;
  } else {
    $('#studioResolution').value = '1920x1080';
    $('#studioFps').value = '30';
    $('#studioCodec').value = 'h264';
    $('#studioBitrate').value = '5000';
    $('#studioAutoBitrate').checked = true;
  }
});
for (const input of $$('[data-studio-provider]')) input.addEventListener('change', async () => {
  try {
    await request('/api/studio/provider/' + input.dataset.studioProvider, {
      method: 'PUT', body: JSON.stringify({ enabled: input.checked }),
    });
    $('#studioProviderHint').textContent = String(providers().length) + ' ' + tr('destination(s)');
  } catch (error) {
    input.checked = !input.checked;
    action(error.message, true);
  }
});

for (const button of $$('[data-save-provider]')) button.addEventListener('click', async () => {
  const name = button.dataset.saveProvider;
  let payload = {};
  if (name === 'youtube') payload = { mode: 'rtmps', server: $('#studioYoutubeServer').value, streamKey: $('#studioYoutubeKey').value };
  if (name === 'twitch') payload = { mode: 'rtmp', server: $('#studioTwitchServer').value, streamKey: $('#studioTwitchKey').value };
  if (name === 'restream') payload = {
    mode: $('#studioRestreamMode').value,
    srtUrl: $('#studioRestreamSrt').value,
    server: $('#studioRestreamServer').value,
    streamKey: $('#studioRestreamKey').value,
  };
  const cap = name[0].toUpperCase() + name.slice(1);
  try {
    await request('/api/studio/provider/' + name, { method: 'PUT', body: JSON.stringify(payload) });
    $('#studio' + cap + 'Saved').textContent = tr('Sauvegardé sur le LinkPi');
    if (name === 'youtube') $('#studioYoutubeKey').value = '';
    if (name === 'twitch') $('#studioTwitchKey').value = '';
    if (name === 'restream') $('#studioRestreamKey').value = '';
    await loadState();
  } catch (error) { $('#studio' + cap + 'Saved').textContent = error.message; }
});
function remoteObsPayload() {
  return {
    remoteMode: $('#studioObsMode').value,
    remoteHost: $('#studioObsHost').value,
    remotePort: Number($('#studioObsPort').value),
    latency: Number($('#studioObsLatency').value),
    passphrase: $('#studioObsPassphrase').value,
    relayPublishUrl: $('#studioObsRelayPublish').value,
    relayReadUrl: $('#studioObsRelayRead').value,
    relayWebUrl: $('#studioObsRelayWeb').value,
    codec: $('#studioObsCodec').value,
  };
}
$('#studioObsMode').addEventListener('change', () => {
  const relay = $('#studioObsMode').value === 'relay';
  for (const field of $$('.studio-relay-only')) field.hidden = !relay;
});
$('#studioObsMode').dispatchEvent(new Event('change'));
$('#studioObsPreview').addEventListener('click', async () => {
  try {
    const preview = await request('/api/studio/remoteobs/preview', { method: 'POST', body: JSON.stringify(remoteObsPayload()) });
    $('#studioObsOutput').textContent = preview.obsUrl || tr('SRT read URL non configurée · utilise Browser Source.');
    $('#studioObsCopy').disabled = !preview.obsUrl;
    if (preview.obsUrl) $('#studioObsCopy').dataset.copyValue = preview.obsUrl; else delete $('#studioObsCopy').dataset.copyValue;
    $('#studioWebOutput').textContent = preview.browserUrl || tr('Browser Source relay non configurée.');
    $('#studioWebCopy').disabled = !preview.browserUrl;
    if (preview.browserUrl) $('#studioWebCopy').dataset.copyValue = preview.browserUrl; else delete $('#studioWebCopy').dataset.copyValue;
  } catch (error) {
    $('#studioObsOutput').textContent = error.message;
    $('#studioObsCopy').disabled = true;
  }
});
$('#studioObsLoadSaved').addEventListener('click', async () => {
  try {
    const saved = await request('/api/studio/remoteobs/link', { method: 'POST', body: '{}' });
    $('#studioObsOutput').textContent = saved.obsUrl || tr('SRT read URL non configurée · utilise Browser Source.');
    $('#studioObsCopy').disabled = !saved.obsUrl;
    if (saved.obsUrl) $('#studioObsCopy').dataset.copyValue = saved.obsUrl; else delete $('#studioObsCopy').dataset.copyValue;
    $('#studioWebOutput').textContent = saved.browserUrl || tr('Browser Source relay non configurée.');
    $('#studioWebCopy').disabled = !saved.browserUrl;
    if (saved.browserUrl) $('#studioWebCopy').dataset.copyValue = saved.browserUrl; else delete $('#studioWebCopy').dataset.copyValue;
  } catch (error) {
    $('#studioObsOutput').textContent = error.message;
    $('#studioObsCopy').disabled = true;
  }
});
$('#studioObsCopy').addEventListener('click', async () => {
  const value = $('#studioObsCopy').dataset.copyValue;
  if (!value) return;
  await navigator.clipboard.writeText(value);
  $('#studioObsCopy').textContent = tr('Copié ✓');
  setTimeout(() => { $('#studioObsCopy').textContent = tr('Copier'); }, 1200);
});
$('#studioWebCopy').addEventListener('click', async () => {
  const value = $('#studioWebCopy').dataset.copyValue;
  if (!value) return;
  await navigator.clipboard.writeText(value);
  $('#studioWebCopy').textContent = tr('Copié ✓');
  setTimeout(() => { $('#studioWebCopy').textContent = tr('Copier Browser Source'); }, 1200);
});

$('#studioObsSave').addEventListener('click', async () => {
  try {
    await request('/api/studio/provider/remoteobs', { method: 'PUT', body: JSON.stringify(remoteObsPayload()) });
    $('#studioObsPassphrase').value = '';
    action('Remote OBS sauvegardé');
    await loadState();
  } catch (error) { action(error.message, true); }
});

function updateGuestMode() {
  const receive = $('#studioGuestMode').value === 'receive-srt';
  $('#studioGuestHostField').hidden = !receive;
  $('#studioGuestUrlField').hidden = receive;
  if (receive && !$('#studioGuestHost').value) $('#studioGuestHost').value = window.location.hostname;
}
$('#studioGuestMode').addEventListener('change', updateGuestMode);
updateGuestMode();

$('#studioGuestApply').addEventListener('click', async () => {
  const slot = Number($('#studioGuestSlot').value);
  try {
    const configured = await request('/api/studio/network/' + slot, {
      method: 'PUT',
      body: JSON.stringify({
        inputMode: $('#studioGuestMode').value,
        name: $('#studioGuestName').value,
        url: $('#studioGuestUrl').value,
        audio: $('#studioGuestAudio').value === 'yes',
        video: true,
        bufferMode: Number($('#studioGuestBuffer').value),
        minDelay: 300,
        transport: 'tcp',
        publishHost: $('#studioGuestHost').value || window.location.hostname,
      }),
    });
    $('#studioGuestStatus').textContent = configured.rebootRequired
      ? tr('SLS activé · redémarre le LinkPi une fois avant le premier invité SRT.')
      : tr('Net' + slot + ' configuré.');
    if (configured.publisherUrl) {
      $('#studioGuestOutput').textContent = configured.publisherUrl;
      $('#studioGuestCopy').disabled = false;
      $('#studioGuestCopy').dataset.copyValue = configured.publisherUrl;
    } else {
      $('#studioGuestOutput').textContent = tr('Source pull configurée.');
      $('#studioGuestCopy').disabled = true;
      delete $('#studioGuestCopy').dataset.copyValue;
    }
    await loadState();
  } catch (error) { $('#studioGuestStatus').textContent = error.message; }
});
$('#studioGuestCopy').addEventListener('click', async () => {
  const value = $('#studioGuestCopy').dataset.copyValue;
  if (!value) return;
  await navigator.clipboard.writeText(value);
  $('#studioGuestCopy').textContent = tr('Copié ✓');
  setTimeout(() => { $('#studioGuestCopy').textContent = tr('Copier'); }, 1200);
});
$('#studioGuestDisable').addEventListener('click', async () => {
  const slot = Number($('#studioGuestSlot').value);
  try {
    await request('/api/studio/network/' + slot, { method: 'DELETE' });
    $('#studioGuestStatus').textContent = tr('Net' + slot + ' désactivé.');
    await loadState();
  } catch (error) { $('#studioGuestStatus').textContent = error.message; }
});

$('#studioStartStream').addEventListener('click', async () => {
  studioBusy = true;
  try {
    const selected = providers();
    if (!selected.length) throw new Error(tr('Choisis au moins une destination.'));
    action('Démarrage du stream…');
    await request('/api/studio/stream/start', { method: 'POST', body: JSON.stringify({ ...studioPayload(), providers: selected }) });
    action('Stream lancé');
    await loadState();
  } catch (error) { action(error.message, true); }
  finally { studioBusy = false; }
});
$('#studioStopStream').addEventListener('click', async () => {
  try {
    action('Arrêt du stream…');
    await request('/api/studio/stream/stop', { method: 'POST', body: '{}' });
    action('Stream arrêté');
    await loadState();
  } catch (error) { action(error.message, true); }
});
$('#studioStartRecord').addEventListener('click', async () => {
  studioBusy = true;
  try {
    action('Démarrage de l’enregistrement…');
    await request('/api/studio/record/start', { method: 'POST', body: JSON.stringify({ ...studioPayload(), recordSources: recordSources() }) });
    action('Enregistrement lancé');
    await loadState();
  } catch (error) { action(error.message, true); }
  finally { studioBusy = false; }
});
$('#studioStopRecord').addEventListener('click', async () => {
  try {
    action('Arrêt de l’enregistrement…');
    await request('/api/studio/record/stop', { method: 'POST', body: '{}' });
    action('Enregistrement arrêté');
    await loadState();
  } catch (error) { action(error.message, true); }
});
$('#studioPrepareAuto').addEventListener('click', async () => {
  try {
    action('Préparation des scènes Auto Director…');
    const result = await request('/api/studio/autodirector/prepare', {
      method: 'POST',
      body: JSON.stringify({
        cameraA: Number($('#studioAutoCamA').value),
        audioA: Number($('#studioAutoAudioA').value),
        cameraB: Number($('#studioAutoCamB').value),
        audioB: Number($('#studioAutoAudioB').value),
      }),
    });
    action(result.carouselReady ? 'Scènes Auto Director prêtes' : 'Scènes préparées · vérifie Carousel');
    await loadState();
  } catch (error) { action(error.message, true); }
});

for (const button of $$('[data-studio-calibrate]')) button.addEventListener('click', async () => {
  const [speaker, phase] = button.dataset.studioCalibrate.split(':');
  try {
    action(phase === 'noise' ? 'Mesure du silence…' : 'Mesure de la parole…');
    const result = await request('/api/studio/autodirector/calibrate', {
      method: 'POST', body: JSON.stringify({ speaker, phase }),
    });
    action((phase === 'noise' ? 'Silence' : 'Parole') + ' ' + speaker.toUpperCase() + ' = ' + result.value);
    await loadState();
  } catch (error) { action(error.message, true); }
});

for (const button of $$('[data-studio-mode]')) button.addEventListener('click', async () => {
  try {
    const response = await request('/api/mode', { method: 'POST', body: JSON.stringify({ mode: button.dataset.studioMode }) });
    $('#studioAutoBadge').textContent = response.mode || button.dataset.studioMode;
    $('#studioAutoHint').textContent = response.readiness?.autoReady ? tr('AUTO est prêt.') : tr('AUTO reste verrouillé tant que calibration et scènes ne sont pas validées.');
  } catch (error) { $('#studioAutoHint').textContent = error.message; }
});

const languageSelect = $('#languageSelect');
languageSelect.addEventListener('change', () => {
  locale = normalizeLocale(languageSelect.value);
  applyStudioLocale(locale);
  if (studioState) render(studioState);
});

applyStudioLocale(locale);
loadState();
setInterval(() => loadState().catch(() => {}), 2000);
