import type * as THREE from 'three';
import { imageWireframe } from './imageWireframe';
import { photoPoints } from './photoPoints';
import { cat, football } from './models';
import { loadWireModel } from './wireModel';

export type AssetName = 'me' | 'lelouch' | 'ball' | 'cat' | 'porsche' | 'lfa';

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
    label: 'sketching cat.png → wireframe',
    run: async () => {
      await nextFrame();
      assets.cat = cat();
    },
  },
  {
    label: 'loading porsche 930 turbo model',
    run: async () => {
      assets.porsche = await loadWireModel('/models/porsche930.bin', {
        body: [0.66, 0.68, 0.74],
        glass: [0.5, 0.68, 0.86],
        lamp: [1, 1, 0.94],
        trim: [0.42, 0.45, 0.52],
        wheel: [0.55, 0.57, 0.62],
        amber: [1, 0.62, 0.1],
        red: [1, 0.22, 0.18],
        // The model's nose points to -x; flip so the front leads, then lamps behind the
        // middle are the tail lamps.
        flipX: true,
        tailBelowX: 0,
      });
    },
  },
  {
    label: 'loading lexus lfa model',
    run: async () => {
      assets.lfa = await loadWireModel('/models/lfa.bin', {
        body: [0.78, 0.8, 0.86],
        glass: [0.5, 0.68, 0.86],
        lamp: [1, 1, 0.94],
        trim: [0.42, 0.45, 0.52],
        wheel: [0.55, 0.57, 0.62],
        amber: [1, 0.62, 0.1],
        red: [1, 0.22, 0.18],
        flipX: true,
      });
    },
  },
];
