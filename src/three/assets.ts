import type * as THREE from 'three';
import { photoPoints } from './photoPoints';
import { football } from './models';
import { loadWireModel } from './wireModel';

export type AssetName = 'me' | 'sword' | 'ball' | 'cat' | 'porsche' | 'lfa';

/** Geometry cache filled during the boot screen and read synchronously by the scene. */
export const assets = {} as Record<AssetName, THREE.BufferGeometry>;

export interface AssetTask {
  label: string;
  run: () => Promise<void>;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/** Shared colours for extracted models; each model overrides what it needs. */
const STEEL = {
  body: [0.7, 0.72, 0.78],
  glass: [0.5, 0.68, 0.86],
  lamp: [1, 1, 0.94],
  trim: [0.42, 0.45, 0.52],
  wheel: [0.55, 0.57, 0.62],
  amber: [1, 0.62, 0.1],
  red: [1, 0.22, 0.18],
} satisfies Record<string, [number, number, number]>;

export const assetTasks: AssetTask[] = [
  {
    label: 'sampling home_me.png → particles',
    run: async () => {
      assets.me = await photoPoints('/images/home_me.png', { width: 150, relief: 0.04, bulge: 0.16 });
    },
  },
  {
    label: 'loading berserk sword model',
    run: async () => {
      assets.sword = await loadWireModel('/models/sword.bin', { ...STEEL, body: [0.74, 0.78, 0.86] });
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
    label: 'loading cat model',
    run: async () => {
      assets.cat = await loadWireModel('/models/cat.bin', {
        ...STEEL,
        body: [0.66, 0.69, 0.76],
        lamp: [1, 0.78, 0.22], // eyes
        trim: [0.92, 0.92, 0.92], // whiskers
      });
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
