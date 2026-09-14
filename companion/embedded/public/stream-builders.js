function result(ok, value = '', error = null, extra = {}) {
  return { ok, value, error, ...extra };
}

function validPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function validHost(value) {
  return typeof value === 'string' && value.trim() !== '' && !/\s/.test(value);
}

function validIpv4(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255 && String(n) === String(Number(part));
  });
}

export function buildRtmp({ server, key } = {}) {
  const base = String(server ?? '').trim();
  const streamKey = String(key ?? '').trim();
  if (!/^rtmps?:\/\//i.test(base)) return result(false, '', 'Server must use RTMP or RTMPS');
  if (!streamKey) return result(false, '', 'Stream key is required');
  return result(true, `${base.replace(/\/+$/, '')}/${streamKey.replace(/^\/+/, '')}`);
}
export function buildSrt({ host, port, mode, latency, passphrase = '', streamid = '' } = {}) {
  const cleanHost = String(host ?? '').trim();
  const cleanMode = String(mode ?? '').toLowerCase();
  const latencyMs = Number(latency);
  if (!validHost(cleanHost)) return result(false, '', 'Host is required');
  if (!validPort(port)) return result(false, '', 'Port must be between 1 and 65535');
  if (!['caller', 'listener', 'rendezvous'].includes(cleanMode)) return result(false, '', 'Invalid SRT mode');
  if (!Number.isFinite(latencyMs) || latencyMs < 20 || latencyMs > 8000) return result(false, '', 'Latency must be 20–8000 ms');
  const query = [`mode=${encodeURIComponent(cleanMode)}`, `latency=${Math.round(latencyMs)}`];
  if (passphrase) query.push(`passphrase=${encodeURIComponent(passphrase)}`);
  if (streamid) query.push(`streamid=${encodeURIComponent(streamid)}`);
  return result(true, `srt://${cleanHost}:${Number(port)}?${query.join('&')}`);
}

export function buildUdp({ ip, port, rtp = false, ttl = 5 } = {}) {
  const cleanIp = String(ip ?? '').trim();
  const ttlValue = Number(ttl);
  if (!validIpv4(cleanIp)) return result(false, '', 'Destination must be a valid IPv4 address');
  if (!validPort(port)) return result(false, '', 'Port must be between 1 and 65535');
  if (!Number.isInteger(ttlValue) || ttlValue < 1 || ttlValue > 255) return result(false, '', 'TTL must be 1–255');
  const firstOctet = Number(cleanIp.split('.')[0]);
  const kind = firstOctet >= 224 && firstOctet <= 239 ? 'multicast' : 'unicast';
  const fields = { enable: true, ip: cleanIp, port: Number(port), ttl: ttlValue, rtp: Boolean(rtp), flowCtrl: true, bandwidth: 100 };
  const scheme = rtp ? 'rtp' : 'udp';
  return result(true, `${scheme}://${cleanIp}:${Number(port)}`, null, { kind, fields });
}
