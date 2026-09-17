import type * as THREE from 'three';
import { imageWireframe } from './imageWireframe';
import { astonVanquish, cat, porsche930, soccerBall } from './models';

export type AssetName = 'me' | 'lelouch' | 'ball' | 'cat' | 'porsche' | 'aston';

/** Geometry cache filled during the boot screen and read synchronously by the scene. */
export const assets = {} as Record<AssetName, THREE.BufferGeometry>;

export interface AssetTask {
  label: string;
  run: () => Promise<void>;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

export const assetTasks: AssetTask[] = [
  {
    label: 'tracing Home_me.png → wireframe',
    run: async () => {
      assets.me = await imageWireframe('/images/home_me.png', {
        mask: 'alpha',
        cols: 58,
        relief: 0.06,
        bulge: 0.12,
        detail: 0.14,
      });
    },
  },
  {
    label: 'tracing lelouch.jpeg → wireframe',
    run: async () => {
      assets.lelouch = await imageWireframe('/images/lelouch.jpeg', {
        mask: 'focus',
        focusThreshold: 0.3,
        // Studio watermarks in the top-right and bottom-right corners.
        exclude: [
          [0.7, 0, 0.3, 0.1],
          [0.8, 0.88, 0.2, 0.12],
        ],
        cols: 80,
        relief: 0.05,
        bulge: 0.08,
        detail: 0.22,
      });
    },
  },
  {
    label: 'stitching soccer ball',
    run: async () => {
      await nextFrame();
      assets.ball = soccerBall();
    },
  },
  {
    label: 'sculpting cat',
    run: async () => {
      await nextFrame();
      assets.cat = cat();
    },
  },
  {
    label: 'lofting porsche 930 turbo',
    run: async () => {
      await nextFrame();
      assets.porsche = porsche930();
    },
  },
  {
    label: 'lofting aston martin vanquish',
    run: async () => {
      await nextFrame();
      assets.aston = astonVanquish();
    },
  },
];
