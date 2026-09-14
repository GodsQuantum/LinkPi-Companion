import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRtmp, buildSrt, buildUdp } from '../public/stream-builders.js';

test('RTMP builder preserves RTMPS and joins server/key once', () => {
  assert.deepEqual(buildRtmp({ server: 'rtmps://a.example/live2/', key: '/abc123' }), {
    ok: true, value: 'rtmps://a.example/live2/abc123', error: null,
  });
  assert.equal(buildRtmp({ server: 'https://wrong.example', key: 'x' }).ok, false);
  assert.equal(buildRtmp({ server: 'rtmp://a.example/live', key: '' }).ok, false);
});

test('SRT builder validates ranges and URL-encodes optional parameters', () => {
  const built = buildSrt({ host: '203.0.113.20', port: 7001, mode: 'caller', latency: 120, passphrase: 'a b&c', streamid: 'live/test' });
  assert.equal(built.ok, true);
  assert.equal(built.value, 'srt://203.0.113.20:7001?mode=caller&latency=120&passphrase=a%20b%26c&streamid=live%2Ftest');
  assert.equal(buildSrt({ host: 'x', port: 0, mode: 'caller', latency: 50 }).ok, false);
  assert.equal(buildSrt({ host: 'x', port: 7001, mode: 'bad', latency: 50 }).ok, false);
});

test('UDP builder distinguishes multicast and RTP while returning LinkPi fields', () => {
  const multicast = buildUdp({ ip: '239.1.1.1', port: 5000, rtp: true, ttl: 5 });
  assert.equal(multicast.ok, true);
  assert.equal(multicast.value, 'rtp://239.1.1.1:5000');
  assert.equal(multicast.kind, 'multicast');
  assert.deepEqual(multicast.fields, { enable: true, ip: '239.1.1.1', port: 5000, ttl: 5, rtp: true, flowCtrl: true, bandwidth: 100 });
  assert.equal(buildUdp({ ip: '999.1.1.1', port: 5000, rtp: false, ttl: 5 }).ok, false);
  assert.equal(buildUdp({ ip: '192.168.1.20', port: 70000, rtp: false, ttl: 5 }).ok, false);
});
