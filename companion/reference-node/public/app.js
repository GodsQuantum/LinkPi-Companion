import { buildRtmp, buildSrt, buildUdp } from './stream-builders.js';
import { applyLocale, normalizeLocale, t, translateText } from './i18n.js';
import { nativeUrl } from './native-pages.js';
import './studio.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const LANGUAGE_STORAGE_KEY = 'linkpi-companion-language';
const URL_LANGUAGE = new URLSearchParams(window.location.search).get('lang');
let currentLocale = normalizeLocale(URL_LANGUAGE || localStorage.getItem(LANGUAGE_STORAGE_KEY) || navigator.language);
const tr = source => translateText(currentLocale, source);

function showView(name, { updateHash = true } = {}) {
  const safe = ['guide', 'studio', 'director', 'status'].includes(name) ? name : 'guide';
  for (const view of $$('[data-view]')) view.classList.toggle('view-active', view.dataset.view === safe);
  for (const button of $$('[data-nav-target]')) button.classList.toggle('active', button.dataset.navTarget === safe);
  if (updateHash && window.location.hash !== `#${safe}`) window.location.hash = safe;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

for (const button of $$('[data-nav-target]')) button.addEventListener('click', () => showView(button.dataset.navTarget));
for (const button of $$('[data-go-view]')) button.addEventListener('click', () => showView(button.dataset.goView));
window.addEventListener('hashchange', () => showView(window.location.hash.slice(1), { updateHash: false }));

const modeButtons = [...document.querySelectorAll('[data-mode]')];
const readinessDefs = [
  ['rpcReady', 'RPC LinkPi', 'boîtier joignable'],
  ['videoReady', 'Caméras', '2 sources vidéo présentes'],
  ['detectorsReady', 'Meters A/B', '2 signaux audio observables'],
  ['calibrationReady', 'Calibration', 'silence + parole référencés'],
  ['scenesReady', 'Scènes', 'A / B / split validés'],
];

let lastState = null;
let polling = false;

const GUIDE_STORAGE_KEY = 'linkpi-companion-guide-progress';
const guideSteps = ['cameras', 'video-audio', 'autodirector', 'recording', 'streaming', 'preflight'];
let currentGuideStep = 'cameras';
let completedGuideSteps = new Set();
let companionData = { summary: null, channels: null, recording: null, streaming: null };

function setLanguage(locale, { save = true, rerender = true } = {}) {
  currentLocale = normalizeLocale(locale);
  $('#languageSelect').value = currentLocale;
  if (save) localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLocale);
  applyLocale(currentLocale);
  showGuideStep(currentGuideStep, { save: false });
  refreshStreamBuilders();
  if (rerender) {
    renderCompanionStatic();
    if (lastState) render(lastState);
  }
}

$('#languageSelect').addEventListener('change', event => setLanguage(event.target.value));

function loadGuideProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUIDE_STORAGE_KEY) || '{}');
    if (guideSteps.includes(saved.current)) currentGuideStep = saved.current;
    if (Array.isArray(saved.completed)) completedGuideSteps = new Set(saved.completed.filter(step => guideSteps.includes(step)));
  } catch {}
}

function saveGuideProgress() {
  localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify({
    current: currentGuideStep,
    completed: [...completedGuideSteps],
  }));
}

function showGuideStep(name, { save = true } = {}) {
  const safe = guideSteps.includes(name) ? name : 'cameras';
  currentGuideStep = safe;
  for (const card of $$('[data-guide-step]')) card.classList.toggle('active', card.dataset.guideStep === safe);
  for (const button of $$('[data-step-target]')) {
    button.classList.toggle('active', button.dataset.stepTarget === safe);
    button.classList.toggle('done', completedGuideSteps.has(button.dataset.stepTarget));
  }
  const index = guideSteps.indexOf(safe);
  $('#guideProgress').textContent = t(currentLocale, 'guide.progress', { current: index + 1, total: guideSteps.length });
  $('#guidePrev').disabled = index === 0;
  $('#guideNext').disabled = index === guideSteps.length - 1;
  if (save) saveGuideProgress();
}

function resetGuide() {
  completedGuideSteps.clear();
  currentGuideStep = 'cameras';
  localStorage.removeItem(GUIDE_STORAGE_KEY);
  showGuideStep('cameras', { save: false });
}

for (const button of $$('[data-step-target]')) button.addEventListener('click', () => showGuideStep(button.dataset.stepTarget));
for (const button of $$('[data-guide-jump]')) button.addEventListener('click', () => showGuideStep(button.dataset.guideJump));
for (const button of $$('[data-complete-step]')) button.addEventListener('click', () => {
  completedGuideSteps.add(button.dataset.completeStep);
  saveGuideProgress();
  showGuideStep(guideSteps[Math.min(guideSteps.indexOf(button.dataset.completeStep) + 1, guideSteps.length - 1)]);
});
$('#resetGuide').addEventListener('click', resetGuide);
$('#guidePrev').addEventListener('click', () => showGuideStep(guideSteps[Math.max(0, guideSteps.indexOf(currentGuideStep) - 1)]));
$('#guideNext').addEventListener('click', () => showGuideStep(guideSteps[Math.min(guideSteps.length - 1, guideSteps.indexOf(currentGuideStep) + 1)]));

async function companionGet(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadCompanionData() {
  const [summary, channels, recording, streaming] = await Promise.all([
    companionGet('/api/companion/summary'),
    companionGet('/api/companion/channels'),
    companionGet('/api/companion/recording'),
    companionGet('/api/companion/streaming'),
  ]);
  companionData = { summary, channels, recording, streaming };
  renderCompanionStatic();
}

function setGenerated(outputId, copyButton, built, emptyText) {
  const output = $(`#${outputId}`);
  if (built?.ok) {
    output.textContent = built.value;
    output.classList.remove('generated-error');
    copyButton.disabled = false;
    copyButton.dataset.copyValue = built.value;
  } else {
    output.textContent = tr(built?.error || emptyText);
    output.classList.add('generated-error');
    copyButton.disabled = true;
    delete copyButton.dataset.copyValue;
  }
}

function refreshStreamBuilders() {
  const configs = [
    ['youtubeOutput', buildRtmp({ server: $('#youtubeServer').value, key: $('#youtubeKey').value })],
    ['twitchOutput', buildRtmp({ server: $('#twitchServer').value, key: $('#twitchKey').value })],
    ['rtmpOutput', buildRtmp({ server: $('#rtmpServer').value, key: $('#rtmpKey').value })],
    ['srtOutput', buildSrt({ host: $('#srtHost').value, port: Number($('#srtPort').value), mode: $('#srtMode').value, latency: Number($('#srtLatency').value), passphrase: $('#srtPassphrase').value, streamid: $('#srtStreamId').value })],
    ['udpOutput', buildUdp({ ip: $('#udpIp').value, port: Number($('#udpPort').value), rtp: $('#udpRtp').checked, ttl: Number($('#udpTtl').value) })],
  ];
  for (const [outputId, built] of configs) {
    const button = $(`[data-copy-target="${outputId}"]`);
    setGenerated(outputId, button, built, 'Complète les champs.');
  }
}

for (const input of $$('[data-protocol-panel] input, [data-protocol-panel] select')) {
  input.addEventListener('input', refreshStreamBuilders);
  input.addEventListener('change', refreshStreamBuilders);
}
for (const tab of $$('[data-protocol-tab]')) tab.addEventListener('click', () => {
  for (const button of $$('[data-protocol-tab]')) button.classList.toggle('active', button === tab);
  for (const panel of $$('[data-protocol-panel]')) panel.classList.toggle('active', panel.dataset.protocolPanel === tab.dataset.protocolTab);
});
for (const button of $$('[data-copy-target]')) button.addEventListener('click', async () => {
  const value = button.dataset.copyValue;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    const original = button.textContent;
    button.textContent = tr('Copié ✓');
    setTimeout(() => { button.textContent = original; }, 1200);
  } catch {
    button.textContent = tr('Copie impossible');
  }
});

function pct(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
}

function setMeter(name, value) {
  const fill = $(`#meter${name}`);
  const score = $(`#score${name}`);
  const percent = Number.isFinite(value) ? Math.round(value * 100) : 0;
  fill.style.width = `${percent}%`;
  score.textContent = Number.isFinite(value) ? `${percent}%` : '—';
}

function renderReadiness(readiness = {}) {
  const list = $('#readinessList');
  list.replaceChildren();
  let readyCount = 0;
  for (const [key, title, description] of readinessDefs) {
    const ok = readiness[key] === true;
    if (ok) readyCount += 1;
    const item = document.createElement('div');
    item.className = `check-item${ok ? ' ok' : ''}`;
    const dot = document.createElement('span');
    dot.className = 'check-dot';
    const label = document.createElement('strong');
    label.textContent = tr(title);
    const detail = document.createElement('span');
    detail.textContent = ok ? 'OK' : tr(description);
    item.append(dot, label, detail);
    list.append(item);
  }
  $('#readySummary').textContent = `${readyCount} / ${readinessDefs.length}`;
}

function missingReadiness(readiness = {}) {
  return readinessDefs
    .filter(([key]) => !readiness[key])
    .map(([, title]) => tr(title));
}

function setStatusDot(id, state) {
  const dot = $(`#${id}`);
  dot.className = `status-dot${state === true ? ' ok' : (state === 'warn' ? ' warn' : '')}`;
}

function renderReadinessInto(selector, readiness = {}) {
  const list = $(selector);
  list.replaceChildren();
  for (const [key, title, description] of readinessDefs) {
    const ok = readiness[key] === true;
    const item = document.createElement('div');
    item.className = `check-item${ok ? ' ok' : ''}`;
    const dot = document.createElement('span'); dot.className = 'check-dot';
    const label = document.createElement('strong'); label.textContent = tr(title);
    const detail = document.createElement('span'); detail.textContent = ok ? 'OK' : tr(description);
    item.append(dot, label, detail); list.append(item);
  }
}

function renderCompanionStatic() {
  const channels = companionData.channels?.channels ?? [];
  const channelBox = $('#guideChannels');
  channelBox.replaceChildren();
  if (!channels.length) {
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = tr('Aucun canal lisible pour le moment.'); channelBox.append(p);
  } else {
    for (const channel of channels.slice(0, 4)) {
      const card = document.createElement('div'); card.className = 'channel-card';
      const title = document.createElement('h3'); title.textContent = tr(`${channel.name || `Canal ${channel.id}`} · ${channel.enabled ? 'actif' : 'inactif'}`);
      const meta = document.createElement('div'); meta.className = 'channel-meta';
      const v = channel.video ?? {}, a = channel.audio ?? {};
      for (const value of [v.codec?.toUpperCase(), v.width && v.height ? `${v.width}×${v.height}` : null, v.framerate ? `${v.framerate} fps` : null, v.bitrate ? `${v.bitrate} kb/s` : null, a.codec?.toUpperCase(), a.samplerate ? `${a.samplerate / 1000} kHz` : null].filter(Boolean)) {
        const span = document.createElement('span'); span.textContent = value; meta.append(span);
      }
      card.append(title, meta); channelBox.append(card);
    }
  }

  const recording = companionData.recording;
  if (recording) {
    const box = $('#recordingSummary'); box.replaceChildren();
    const disk = document.createElement('div');
    disk.innerHTML = `<strong>${tr('Stockage')}</strong><p class="muted">${tr(recording.disk?.externalConfigured ? 'Disque externe configuré' : 'Aucun disque externe confirmé')}</p>`;
    const format = document.createElement('div');
    format.innerHTML = `<strong>${tr('Enregistrement')}</strong><p class="muted">${tr(recording.format?.mp4 ? 'MP4 activé' : 'MP4 non activé')} · ${tr(`${recording.channels?.length ?? 0} canal(aux) sélectionné(s)`)}</p>`;
    box.append(disk, format);
    setStatusDot('guideDiskDot', recording.disk?.externalConfigured === true);
    $('#guideDiskText').textContent = tr(recording.disk?.externalConfigured ? 'Disque externe configuré' : 'Disque externe à préparer');
    $('#stepRecordStatus').textContent = tr(recording.disk?.externalConfigured && recording.format?.mp4 ? 'BON DÉBUT' : 'À VÉRIFIER');
    $('#statusStorageTitle').textContent = tr(recording.disk?.externalConfigured ? 'Stockage externe configuré' : 'Stockage externe non confirmé');
    $('#statusStorageCopy').textContent = `${tr(recording.format?.mp4 ? 'MP4 actif' : 'MP4 à activer')} · ${tr(`${recording.channels?.length ?? 0} canal(aux) sélectionné(s)`)}.`;
  }
  if (lastState) renderPreflight(lastState);
}

function renderGuideState(state) {
  const rpcOk = state.health?.rpc === true;
  setStatusDot('guideRpcDot', rpcOk);
  $('#guideRpcText').textContent = tr(rpcOk ? 'RPC connecté' : 'RPC indisponible');
  const inputs = state.telemetry?.inputs ?? [];
  const hdmi = inputs.find(input => String(input.protocol ?? input.name ?? '').toUpperCase().includes('HDMI'));
  const usb = inputs.find(input => ['UVC','USB'].some(word => String(input.protocol ?? input.name ?? '').toUpperCase().includes(word)));
  const hdmiOk = hdmi?.avalible === true, usbOk = usb?.avalible === true;
  setStatusDot('hdmiDot', hdmiOk); setStatusDot('usbDot', usbOk);
  $('#hdmiState').textContent = tr(hdmiOk ? 'Signal détecté' : 'Aucun signal HDMI');
  $('#usbState').textContent = tr(usbOk ? 'Source UVC détectée' : 'Aucune source USB/UVC');
  setStatusDot('guideCameraDot', hdmiOk && usbOk);
  $('#guideCameraText').textContent = tr(`${Number(hdmiOk) + Number(usbOk)} / 2 détectées`);
  $('#stepCameraStatus').textContent = hdmiOk && usbOk ? 'OK' : tr('À VÉRIFIER');
  renderReadinessInto('#guideDirectorChecks', state.readiness);
  setStatusDot('guideAutoDot', state.readiness?.autoReady === true ? true : 'warn');
  $('#guideAutoText').textContent = tr(state.readiness?.autoReady ? 'Prêt à armer' : 'Calibration/scènes incomplètes');
  $('#stepAutoStatus').textContent = tr(state.readiness?.autoReady ? 'PRÊT' : 'À CALIBRER');

  const statusInputs = $('#statusInputs'); statusInputs.replaceChildren();
  for (const input of inputs) {
    const row = document.createElement('div'); row.className = 'status-line';
    const dot = document.createElement('span'); dot.className = `status-dot${input.avalible === true ? ' ok' : ''}`;
    const name = document.createElement('strong'); name.textContent = input.name || input.protocol || `Canal ${input.chnId}`;
    const value = document.createElement('small'); value.textContent = tr(input.avalible === true ? 'Détecté' : 'Absent');
    row.append(dot, name, value); statusInputs.append(row);
  }
  $('#statusCameraCount').textContent = `${inputs.filter(i => i.avalible === true).length} / ${inputs.length}`;
  renderPreflight(state);
}

function renderChecklist(list, items) {
  list.replaceChildren();
  for (const item of items) {
    const row = document.createElement('div');
    row.className = `preflight-item${item.ok ? ' ok' : ''}`;
    const mark = document.createElement('span');
    mark.textContent = item.ok ? '✓' : '•';
    const copy = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = tr(item.title);
    const detail = document.createElement('small'); detail.textContent = tr(item.detail);
    copy.append(title, detail); row.append(mark, copy); list.append(row);
  }
}

function renderPreflight(state) {
  if (!state) return;
  const wantDirector = $('#workflowDirector').checked;
  const wantRecording = $('#workflowRecording').checked;
  const wantStreaming = $('#workflowStreaming').checked;
  const selected = wantDirector || wantRecording || wantStreaming;
  const summary = companionData.summary ?? {};
  const recording = companionData.recording ?? {};
  const streaming = companionData.streaming ?? {};
  const availableInputs = Number(summary.availableInputs ?? (state.telemetry?.inputs ?? []).filter(i => i.avalible === true).length);
  const enabledDestinationCount = Number(summary.streaming?.enabledDestinationCount ?? streaming.destinations?.filter(d => d.enabled).length ?? 0);
  const externalStorageConfigured = summary.recording?.externalStorageConfigured ?? recording.disk?.externalConfigured ?? false;
  const mp4 = summary.recording?.mp4 ?? recording.format?.mp4 ?? false;
  const recordChannelCount = Number(summary.recording?.channelCount ?? recording.channels?.length ?? 0);

  const checks = [
    { ok: state.health?.rpc === true, title: 'LinkPi joignable', detail: state.health?.rpc ? 'RPC OK.' : 'Le Companion ne communique pas avec l’Encoder.' },
    { ok: availableInputs >= 1, title: 'Une source vidéo au minimum', detail: availableInputs >= 1 ? `${availableInputs} source(s) détectée(s).` : 'Branche et active au moins une caméra.' },
  ];
  if (wantDirector) checks.push({ ok: state.readiness?.autoReady === true, title: 'Auto Director prêt', detail: state.readiness?.autoReady ? 'Caméras, meters, calibration et scènes validés.' : `Manque : ${missingReadiness(state.readiness).join(', ') || 'readiness'}.` });
  if (wantRecording) {
    checks.push({ ok: externalStorageConfigured === true, title: 'Disque externe', detail: externalStorageConfigured ? 'Stockage externe configuré.' : 'Configure le disque USB externe dans Storage.' });
    checks.push({ ok: mp4 === true, title: 'Format MP4', detail: mp4 ? 'MP4 activé.' : 'Active MP4 dans Record.' });
    checks.push({ ok: recordChannelCount >= 3, title: 'CAM A + CAM B + PROGRAM', detail: recordChannelCount >= 3 ? `${recordChannelCount} canaux sélectionnés.` : `Seulement ${recordChannelCount} canal(aux) sélectionné(s) : vise 3 après benchmark.` });
  }
  if (wantStreaming) checks.push({ ok: enabledDestinationCount >= 1, title: 'Destination de streaming', detail: enabledDestinationCount >= 1 ? `${enabledDestinationCount} destination(s) activée(s).` : 'Configure puis active au moins une destination Push/Stream dans le LinkPi.' });
  if (!selected) checks.push({ ok: false, title: 'Choisis un workflow', detail: 'Coche Auto Director, Enregistrement et/ou Streaming.' });

  renderChecklist($('#preflightList'), checks);
  const blockers = checks.filter(item => !item.ok);
  renderChecklist($('#problemList'), blockers.length ? blockers : [{ ok: true, title: 'Aucun blocage détecté', detail: 'Les éléments sélectionnés sont prêts.' }]);
  const hardProblem = state.health?.rpc !== true;
  const ready = selected && blockers.length === 0;
  const label = hardProblem ? 'PROBLÈME' : (ready ? 'PRÊT' : 'INCOMPLET');
  const css = hardProblem ? 'status-bad' : (ready ? 'status-good' : 'status-warn');
  for (const id of ['globalReadyBadge', 'statusOverall']) {
    const el = $(`#${id}`); el.textContent = tr(label); el.className = `status-pill ${css}`;
  }
  $('#stepPreflightStatus').textContent = tr(label);
  $('#preflightReady').textContent = ready ? t(currentLocale, 'preflight.ready') : t(currentLocale, 'preflight.blocked', { status: tr(label), count: blockers.length });
  $('#preflightReady').className = `ready-banner${ready ? ' ready' : (hardProblem ? ' problem' : '')}`;
}

for (const id of ['workflowDirector', 'workflowRecording', 'workflowStreaming']) {
  $(`#${id}`).addEventListener('change', () => renderPreflight(lastState));
}

function render(state) {
  lastState = state;
  paintSettings(state.editorialSettings);
  const rpcOk = state.health?.rpc === true;
  $('#rpcBadge').textContent = tr(rpcOk ? 'RPC connecté' : 'RPC hors ligne');
  $('#rpcBadge').className = `status-pill ${rpcOk ? 'status-good' : 'status-bad'}`;

  for (const button of modeButtons) {
    button.classList.toggle('active', button.dataset.mode === state.mode);
  }
  const autoButton = modeButtons.find(button => button.dataset.mode === 'AUTO');
  autoButton.disabled = state.readiness?.autoReady !== true;
  const missing = missingReadiness(state.readiness);
  $('#modeHint').textContent = state.readiness?.autoReady
    ? t(currentLocale, 'mode.ready')
    : t(currentLocale, 'mode.blocked', { missing: missing.join(', ') || tr('télémétrie') });

  const decision = state.lastDecision;
  $('#sceneName').textContent = decision?.scene ?? state.scene ?? '—';
  $('#decisionReason').textContent = decision?.reason ? tr(decision.reason) : tr('Aucune décision éditoriale');
  $('#decisionBadge').textContent = decision?.changed
    ? `CUT · ${decision.scene}`
    : (decision?.candidate ? `${tr('Candidat')} · ${decision.candidate}` : tr('Stable'));

  setMeter('A', state.scores?.a);
  setMeter('B', state.scores?.b);
  renderReadiness(state.readiness);
  renderGuideState(state);

  const system = state.telemetry?.system ?? {};
  $('#cpuStat').textContent = Number.isFinite(system.cpu) ? system.cpu : '—';
  $('#memStat').textContent = Number.isFinite(system.mem) ? system.mem : '—';
  $('#tempStat').textContent = Number.isFinite(system.temperature) ? system.temperature : '—';
  const carousel = state.telemetry?.carousel;
  $('#carouselStat').textContent = tr(carousel?.hadCarousel ? 'Actif' : 'Arrêté');
  $('#carouselMode').textContent = carousel?.activeMode || '—';

  const inputs = state.telemetry?.inputs ?? [];
  const available = inputs.filter(input => input.avalible === true);
  $('#hardwareTitle').textContent = available.length
    ? t(currentLocale, 'hardware.count', { count: available.length })
    : t(currentLocale, 'hardware.none');
  $('#hardwareCopy').textContent = state.readiness?.autoReady
    ? t(currentLocale, 'hardware.ready')
    : t(currentLocale, 'hardware.blocked');

  $('#safeSplit').disabled = !(state.readiness?.rpcReady && state.readiness?.scenesReady);
  $('#lastUpdate').textContent = new Date().toLocaleTimeString(currentLocale === 'fr' ? 'fr-FR' : (currentLocale === 'en' ? 'en-GB' : 'zh-CN'));
  const pulse = $('#pulse');
  pulse.classList.remove('flash');
  requestAnimationFrame(() => pulse.classList.add('flash'));
}

async function setMode(mode) {
  const error = $('#modeError');
  error.hidden = true;
  try {
    const response = await fetch('/api/mode', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    render(body);
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
}

for (const button of modeButtons) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}
$('#safeSplit').addEventListener('click', () => setMode('SAFE_SPLIT'));
async function pollState() {
  if (polling) return;
  polling = true;
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    $('#rpcBadge').textContent = t(currentLocale, 'ui.disconnected');
    $('#rpcBadge').className = 'status-pill status-bad';
    $('#modeError').textContent = t(currentLocale, 'ui.serverError', { error: error.message });
    $('#modeError').hidden = false;
  } finally {
    polling = false;
  }
}

let settingsDirty = false;
const settingInputs = [...document.querySelectorAll('[data-setting]')];

function paintSettings(settings = {}) {
  if (settingsDirty) return;
  for (const input of settingInputs) {
    if (settings[input.dataset.setting] !== undefined) input.value = settings[input.dataset.setting];
  }
}

async function settingsRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

async function loadSettings() {
  const body = await settingsRequest('/api/settings');
  settingsDirty = false;
  paintSettings(body.settings);
}

for (const input of settingInputs) input.addEventListener('input', () => {
  settingsDirty = true;
  $('#settingsStatus').textContent = t(currentLocale, 'settings.unsaved');
});
$('#saveSettings').addEventListener('click', async () => {
  try {
    const payload = Object.fromEntries(settingInputs.map(input => [input.dataset.setting, Number(input.value)]));
    const saved = await settingsRequest('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
    settingsDirty = false;
    paintSettings(saved);
    $('#settingsStatus').textContent = t(currentLocale, 'settings.saved');
  } catch (error) {
    $('#settingsStatus').textContent = t(currentLocale, 'settings.error', { error: error.message });
  }
});

for (const button of document.querySelectorAll('[data-preset]')) {
  button.addEventListener('click', async () => {
    try {
      const saved = await settingsRequest('/api/settings/preset', {
        method: 'POST', body: JSON.stringify({ name: button.dataset.preset }),
      });
      settingsDirty = false;
      paintSettings(saved);
      $('#settingsStatus').textContent = t(currentLocale, 'settings.preset', { name: button.textContent });
    } catch (error) {
      $('#settingsStatus').textContent = t(currentLocale, 'settings.error', { error: error.message });
    }
  });
}

async function init() {
  try {
    const config = await fetch('/api/config/public').then(response => response.json());
    if (config.nativeUiUrl) {
      for (const link of $$('[data-native-page]')) {
        link.href = nativeUrl(config.nativeUiUrl, link.dataset.nativePage);
      }
    }
  } catch {}
  loadGuideProgress();
  setLanguage(currentLocale, { save: false, rerender: false });
  showGuideStep(currentGuideStep, { save: false });
  showView(window.location.hash.slice(1) || 'guide', { updateHash: false });
  await loadSettings();
  try { await loadCompanionData(); } catch {}
  refreshStreamBuilders();
  await pollState();
  setInterval(pollState, 250);
  setInterval(() => loadCompanionData().catch(() => {}), 5000);
}

init();
