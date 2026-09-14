import test from 'node:test';
import assert from 'node:assert/strict';
import { CarouselSceneController } from '../src/carousel-controller.js';

function fakeCarousel(startIndex = 0) {
  const lays = ['ad-a', 'ad-b', 'ad-split'];
  let index = startIndex;
  const calls = [];
  return {
    calls,
    async call(method, params = []) {
      calls.push([method, params]);
      if (method === 'carousel.carouselTimeout') {
        index = (index + 1) % lays.length;
        return null;
      }
      if (method === 'carousel.getState') {
        return {
          hadCarousel: true,
          activeMode: 'layout',
          source: { source1: lays.map((layId, i) => ({
            layId, uid: `uid_${i}`, playTime: i === index ? 1 : 0,
          })) },
        };
      }
      throw new Error(`unexpected ${method}`);
    },
  };
}

const sceneToLayId = {
  CAM_A: 'ad-a',
  CAM_B: 'ad-b',
  SPLIT: 'ad-split',
};

test('advances only the minimum number of Carousel steps', async () => {
  const rpc = fakeCarousel(0);
  const controller = new CarouselSceneController({ rpc, sceneToLayId });
  await controller.apply('SPLIT');
  const advances = rpc.calls.filter(([method]) => method === 'carousel.carouselTimeout');
  assert.equal(advances.length, 2);
  assert.deepEqual(advances[0][1], ['source1']);
});

test('does not rotate when the requested scene is already live', async () => {
  const rpc = fakeCarousel(1);
  const controller = new CarouselSceneController({ rpc, sceneToLayId });
  await controller.apply('CAM_B');
  const advances = rpc.calls.filter(([method]) => method === 'carousel.carouselTimeout');
  assert.equal(advances.length, 0);
});
