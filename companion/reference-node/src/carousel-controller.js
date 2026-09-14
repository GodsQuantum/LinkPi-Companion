const DEFAULT_ORDER = ['CAM_A', 'CAM_B', 'SPLIT'];

export class CarouselSceneController {
  constructor({ rpc, sceneToLayId, sourceKey = 'source1', order = DEFAULT_ORDER }) {
    this.rpc = rpc;
    this.sceneToLayId = sceneToLayId;
    this.sourceKey = sourceKey;
    this.order = [...order];
  }

  async apply(scene) {
    if (!this.order.includes(scene)) throw new Error(`Unknown scene: ${scene}`);
    const before = await this.rpc.call('carousel.getState');
    const current = this.#currentScene(before);
    const from = this.order.indexOf(current);
    const to = this.order.indexOf(scene);
    const steps = (to - from + this.order.length) % this.order.length;
    for (let i = 0; i < steps; i += 1) {
      await this.rpc.call('carousel.carouselTimeout', [this.sourceKey]);
    }
    const after = await this.rpc.call('carousel.getState');
    const actual = this.#currentScene(after);
    if (actual !== scene) throw new Error(`Carousel verification failed: wanted ${scene}, got ${actual}`);
    return actual;
  }

  #currentScene(state) {
    if (!state?.hadCarousel) throw new Error('Carousel is not running');
    if (state.activeMode !== 'layout') throw new Error(`Carousel mode must be layout, got ${state.activeMode}`);
    const items = state.source?.[this.sourceKey];
    if (!Array.isArray(items) || items.length === 0) throw new Error('Carousel source list unavailable');
    const current = items.find(item => Number(item.playTime) > 0);
    if (!current) throw new Error('Carousel current scene is unknown');
    const entry = Object.entries(this.sceneToLayId)
      .find(([, layId]) => String(layId) === String(current.layId));
    if (!entry) throw new Error(`Unmanaged Carousel layout: ${current.layId}`);
    return entry[0];
  }
}
