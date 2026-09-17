import * as THREE from 'three';
import { normalizeGeometry } from './lines';

export interface ImageWireframeOptions {
  /** Width the image is analysed at, in pixels. */
  analysisWidth?: number;
  /** Grid columns across the subject. */
  cols: number;
  /** Depth from brightness (bright areas come forward), as a fraction of subject height. */
  relief: number;
  /** Depth from the silhouette, giving the figure a rounded body, as a fraction of subject height. */
  bulge: number;
  /**
   * How to separate the subject from its background:
   * - `alpha`: use the PNG's transparency.
   * - `focus`: keep sharp, detailed regions and drop blurred backgrounds.
   */
  mask: 'alpha' | 'focus';
  /** For `focus`: 0..1, higher keeps less. */
  focusThreshold?: number;
  /** Normalised [x, y, w, h] rectangles to ignore, e.g. watermarks. */
  exclude?: [number, number, number, number][];
  /** 0..1 share of strongest edges drawn as bright detail strokes. */
  detail?: number;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Separable box blur using running sums. */
function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / (2 * r + 1);
      sum += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (2 * r + 1);
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Keeps the largest connected region and fills its interior holes. */
function cleanMask(mask: Uint8Array, w: number, h: number) {
  const label = new Int32Array(w * h);
  let best = 0;
  let bestSize = 0;
  let next = 1;
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || label[i]) continue;
    let size = 0;
    label[i] = next;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const neighbours = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of neighbours) {
        if (q >= 0 && q < mask.length && mask[q] && !label[q]) {
          label[q] = next;
          stack.push(q);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
    next++;
  }
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < keep.length; i++) keep[i] = label[i] === best ? 1 : 0;

  // Flood the outside from the border; anything unreached is inside.
  const outside = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (outside[p] || keep[p]) continue;
    outside[p] = 1;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  for (let i = 0; i < keep.length; i++) keep[i] = outside[i] ? 0 : 1;
  return keep;
}

/**
 * Converts a photo into a 3D wireframe relief: a grid of scanlines displaced by
 * brightness and silhouette, plus bright strokes along the strongest edges.
 */
export async function imageWireframe(url: string, o: ImageWireframeOptions) {
  const img = await loadImage(url);
  const w = o.analysisWidth ?? 260;
  const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const lum = new Float32Array(w * h);
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    alpha[i] = data[i * 4 + 3] / 255;
  }

  // Gradient magnitude and direction (Sobel).
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  const grad = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = lum[i - w - 1], t = lum[i - w], tr = lum[i - w + 1];
      const l = lum[i - 1], r = lum[i + 1];
      const bl = lum[i + w - 1], b = lum[i + w], br = lum[i + w + 1];
      gx[i] = tr + 2 * r + br - tl - 2 * l - bl;
      gy[i] = bl + 2 * b + br - tl - 2 * t - tr;
      grad[i] = Math.hypot(gx[i], gy[i]);
    }
  }

  let raw = new Uint8Array(w * h);
  // 0..1 weight per pixel; lines fade out where it is low.
  const weight = new Float32Array(w * h).fill(1);
  if (o.mask === 'alpha') {
    for (let i = 0; i < raw.length; i++) raw[i] = alpha[i] > 0.5 ? 1 : 0;
  } else {
    // Sharp regions have dense gradients; blurred backgrounds do not.
    const focus = boxBlur(grad, w, h, Math.round(w * 0.03));
    const sorted = Array.from(focus).sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * (o.focusThreshold ?? 0.45))];
    const hi = sorted[Math.floor(sorted.length * 0.95)];
    const f = new Float32Array(w * h);
    for (let i = 0; i < f.length; i++) f[i] = focus[i] > lo ? 1 : 0;
    const smooth = boxBlur(f, w, h, Math.round(w * 0.025));
    for (let i = 0; i < raw.length; i++) {
      raw[i] = smooth[i] > 0.35 ? 1 : 0;
      const n = Math.min(1, Math.max(0, (focus[i] - lo) / (hi - lo)));
      weight[i] = Math.pow(n, 0.8);
    }
  }
  for (const [ex, ey, ew, eh] of o.exclude ?? []) {
    for (let y = Math.floor(ey * h); y < Math.min(h, (ey + eh) * h); y++) {
      for (let x = Math.floor(ex * w); x < Math.min(w, (ex + ew) * w); x++) raw[y * w + x] = 0;
    }
  }
  raw = cleanMask(raw, w, h);

  const maskF = new Float32Array(w * h);
  for (let i = 0; i < maskF.length; i++) maskF[i] = raw[i];
  const body = boxBlur(boxBlur(maskF, w, h, Math.round(w * 0.05)), w, h, Math.round(w * 0.05));
  const lumS = boxBlur(lum, w, h, 1);

  // Bounding box of the subject.
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!raw[y * w + x]) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }

  const sample = (arr: Float32Array | Uint8Array, x: number, y: number) =>
    arr[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];
  // Depth values are fractions of the subject's height.
  const subject = (maxY - minY) / w;
  const depth = (x: number, y: number) =>
    ((sample(lumS, x, y) - 0.5) * o.relief + sample(body, x, y) * o.bulge) * subject;

  const positions: number[] = [];
  const colors: number[] = [];
  const push = (x: number, y: number, z: number, c: number) => {
    positions.push(x, -y, z);
    colors.push(c, c, c);
  };
  const weightS = boxBlur(weight, w, h, 2);
  const shade = (x: number, y: number) =>
    (0.2 + 0.8 * Math.pow(sample(lumS, x, y), 0.85)) * (0.12 + 0.88 * sample(weightS, x, y));

  // Scanline grid.
  const cell = (maxX - minX) / o.cols;
  const rows = Math.ceil((maxY - minY) / cell);
  const cols = o.cols;
  const unit = 1 / w; // world units per analysis pixel before normalising
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const x = minX + i * cell;
      const y = minY + j * cell;
      if (!sample(raw, x, y)) continue;
      const z = depth(x, y);
      if (i < cols && sample(raw, x + cell, y)) {
        push(x * unit, y * unit, z, shade(x, y));
        push((x + cell) * unit, y * unit, depth(x + cell, y), shade(x + cell, y));
      }
      if (j < rows && sample(raw, x, y + cell)) {
        push(x * unit, y * unit, z, shade(x, y) * 0.7);
        push(x * unit, (y + cell) * unit, depth(x, y + cell), shade(x, y + cell) * 0.7);
      }
    }
  }

  // Detail strokes along strong edges (face, hands, folds, outline).
  const inside: number[] = [];
  for (let i = 0; i < grad.length; i++) if (raw[i]) inside.push(grad[i]);
  inside.sort((a, b) => a - b);
  const edgeThreshold = inside[Math.floor(inside.length * (1 - (o.detail ?? 0.12)))] ?? Infinity;
  const step = Math.max(1, Math.round(cell / 2));
  const len = step * 0.9;
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const i = y * w + x;
      if (!raw[i] || grad[i] < edgeThreshold || weightS[i] < 0.25) continue;
      // Stroke runs along the edge, perpendicular to the gradient.
      const tx = -gy[i] / grad[i];
      const ty = gx[i] / grad[i];
      const z = depth(x, y) + 0.004;
      const c = 0.35 + 0.65 * weightS[i];
      push((x - tx * len) * unit, (y - ty * len) * unit, z, c);
      push((x + tx * len) * unit, (y + ty * len) * unit, z, c);
    }
  }

  // Silhouette outline.
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const i = y * w + x;
      if (!raw[i]) continue;
      if (x + 1 < w && !raw[i + 1]) {
        push((x + 1) * unit, y * unit, depth(x, y), 0.9 * weightS[i]);
        push((x + 1) * unit, (y + 1) * unit, depth(x, y + 1), 0.9 * weightS[i]);
      }
      if (x > 0 && !raw[i - 1]) {
        push(x * unit, y * unit, depth(x, y), 0.9 * weightS[i]);
        push(x * unit, (y + 1) * unit, depth(x, y + 1), 0.9 * weightS[i]);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return normalizeGeometry(g);
}
