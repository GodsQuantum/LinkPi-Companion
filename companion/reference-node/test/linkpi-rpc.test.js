import test from 'node:test';
import assert from 'node:assert/strict';
import { LinkPiRpcClient } from '../src/linkpi-rpc.js';

test('sends LinkPi JSON-RPC calls through /RPC', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: [{ L: 12, R: 3 }] }),
    };
  };
  const rpc = new LinkPiRpcClient({ baseUrl: 'http://192.0.2.10', fetchImpl });
  const result = await rpc.call('enc.getVolume');
  assert.deepEqual(result, [{ L: 12, R: 3 }]);
  assert.equal(request.url, 'http://192.0.2.10/RPC');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {
    jsonrpc: '2.0', id: 1, method: 'enc.getVolume', params: [],
  });
});

test('throws a useful error on JSON-RPC failure', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      jsonrpc: '2.0', id: 1,
      error: { code: -32601, message: 'Method not found' },
    }),
  });
  const rpc = new LinkPiRpcClient({ baseUrl: 'http://192.0.2.10', fetchImpl });
  await assert.rejects(
    () => rpc.call('carousel.nope'),
    /carousel\.nope.*Method not found/,
  );
});
