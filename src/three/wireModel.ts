import * as THREE from 'three';
import { normalizeGeometry, type V3 } from './lines';

/** Segment classes written by tools/extract_wireframe.py. */
export const enum WireClass {
  Body = 0,
  Glass = 1,
  Lamp = 2,
  Trim = 3,
  Wheel = 4,
  Amber = 5,
  Red = 6,
}

export interface WirePalette {
  body: V3;
  glass: V3;
  lamp: V3;
  trim: V3;
  wheel: V3;
  amber: V3;
  red: V3;
  /**
   * Lamps whose x (after normalising, front = +x) is below this are tail lamps and
   * drawn red. For models whose lamp lenses share one material.
   */
  tailBelowX?: number;
  /** Flip the model end-to-end if its front points the wrong way. */
  flipX?: boolean;
}

/**
 * Loads a line drawing extracted from a real 3D model (see tools/extract_wireframe.py)
 * and colours each segment by what it belongs to.
 */
export async function loadWireModel(url: string, palette: WirePalette) {
  const buf = await (await fetch(url)).arrayBuffer();
  const view = new DataView(buf);
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
  if (magic !== 'WF01') throw new Error(`${url} is not a wireframe file`);
  const count = view.getUint32(4, true);
  const mn = [0, 1, 2].map((i) => view.getFloat32(8 + i * 4, true));
  const mx = [0, 1, 2].map((i) => view.getFloat32(20 + i * 4, true));
  const q = new Int16Array(buf, 32, count * 6);
  const cls = new Uint8Array(buf, 32 + count * 12, count);

  const half = mx.map((v, i) => (v - mn[i]) / 2);
  const positions = new Float32Array(count * 6);
  const flip = palette.flipX ? -1 : 1;
  for (let i = 0; i < count * 6; i++) {
    const axis = i % 3;
    positions[i] = (q[i] / 32767) * half[axis] * (axis === 0 ? flip : 1);
  }

  const table: V3[] = [palette.body, palette.glass, palette.lamp, palette.trim, palette.wheel, palette.amber, palette.red];
  const colors = new Float32Array(count * 6);
  const extentX = half[0];
  for (let s = 0; s < count; s++) {
    let c = table[cls[s]] ?? palette.trim;
    if (cls[s] === WireClass.Lamp && palette.tailBelowX !== undefined) {
      const x = (positions[s * 6] + positions[s * 6 + 3]) / 2 / extentX;
      if (x < palette.tailBelowX) c = palette.red;
    }
    colors.set(c, s * 6);
    colors.set(c, s * 6 + 3);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return normalizeGeometry(g);
}
