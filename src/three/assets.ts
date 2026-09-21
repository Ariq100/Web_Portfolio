import type * as THREE from 'three';
import { imageWireframe } from './imageWireframe';
import { photoPoints } from './photoPoints';
import { cat, football } from './models';
import { astonVantage, porsche930 } from './cars';

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
    label: 'sampling home_me.png → particles',
    run: async () => {
      assets.me = await photoPoints('/images/home_me.png', { width: 150, relief: 0.04, bulge: 0.16 });
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
    label: 'stitching football',
    run: async () => {
      await nextFrame();
      assets.ball = football();
    },
  },
  {
    label: 'sculpting jiji',
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
    label: 'lofting aston martin vantage',
    run: async () => {
      await nextFrame();
      assets.aston = astonVantage();
    },
  },
];
