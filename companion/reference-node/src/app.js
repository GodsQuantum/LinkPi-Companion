import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LinkPiRpcClient } from './linkpi-rpc.js';
import { AutoDirectorRuntime } from './director-runtime.js';
import { CarouselSceneController } from './carousel-controller.js';
import { createHttpServer } from './http-server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const configPath = process.env.AUTO_DIRECTOR_CONFIG || path.join(projectRoot, 'config', 'default.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));

const rpc = new LinkPiRpcClient({ baseUrl: config.linkpiBaseUrl });
const sceneController = new CarouselSceneController({
  rpc,
  sceneToLayId: config.runtime.sceneToLayId,
});
const runtime = new AutoDirectorRuntime({
  rpc,
  sceneController,
  config: config.runtime,
});

const server = createHttpServer({
  runtime,
  publicDir: path.join(projectRoot, 'public'),
  publicConfig: {
    nativeUiUrl: `${config.linkpiBaseUrl.replace(/\/$/, '')}/`,
    pollMs: config.pollMs,
  },
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let stopping = false;

async function pollLoop() {
  while (!stopping) {
    const started = Date.now();
    await runtime.pollOnce(started);
    const elapsed = Date.now() - started;
    await sleep(Math.max(0, config.pollMs - elapsed));
  }
}

server.listen(config.listenPort, config.listenHost, () => {
  console.log(`Auto Director listening on http://${config.listenHost}:${config.listenPort}`);
  console.log(`LinkPi target: ${config.linkpiBaseUrl}`);
});

pollLoop().catch(error => {
  console.error('Polling loop stopped:', error);
  process.exitCode = 1;
});

function shutdown() {
  stopping = true;
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
