export class LinkPiRpcClient {
  constructor({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 1500 }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
  }

  async call(method, params = []) {
    const id = this.nextId++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/RPC`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
      const body = await response.json();
      if (body.error) throw new Error(`${method}: ${body.error.message ?? 'RPC error'} (${body.error.code ?? '?'})`);
      return body.result;
    } finally {
      clearTimeout(timer);
    }
  }
}
