import * as THREE from 'three';

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

export interface PhotoPointsOptions {
  /** Width of the particle grid; one particle per opaque cell. */
  width?: number;
  /** Depth from brightness, as a fraction of the subject's height. */
  relief?: number;
  /** Depth from the silhouette, giving the body a rounded front. */
  bulge?: number;
  /** Multiplier on the (levels-stretched) photo colours. */
  brighten?: number;
}

/** How much larger than the grid spacing each tile is, so neighbours overlap into a solid image. */
const TILE = 2.2;

/**
 * Splits a transparent PNG into a grid of particles. Each particle is drawn as a square
 * tile textured with its own patch of the photo, so when assembled they form the full,
 * solid image. The shader uses per-particle scatter offsets and seeds to assemble,
 * disperse and ripple under the cursor.
 */
export async function photoPoints(url: string, o: PhotoPointsOptions = {}) {
  const img = new Image();
  img.src = url;
  await img.decode();

  const w = o.width ?? 150;
  const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const alpha = new Float32Array(w * h);
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = data[i * 4 + 3] / 255;
    lum[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  }

  // Levels: stretch the subject's own brightness range so a dark photo still reads.
  const inside: number[] = [];
  for (let i = 0; i < lum.length; i++) if (alpha[i] > 0.5) inside.push(lum[i]);
  inside.sort((a, b) => a - b);
  const lo = inside[Math.floor(inside.length * 0.01)] ?? 0;
  const hi = inside[Math.floor(inside.length * 0.99)] ?? 1;

  // Rounded body: a heavily blurred silhouette pushes the middle forward.
  const body = boxBlur(boxBlur(alpha, w, h, Math.round(w * 0.06)), w, h, Math.round(w * 0.06));
  const lumS = boxBlur(lum, w, h, 1);

  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] <= 0.5) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const span = Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const subjectH = (maxY - minY) / span;
  const relief = (o.relief ?? 0.04) * subjectH;
  const bulge = (o.bulge ?? 0.14) * subjectH;

  const positions: number[] = [];
  const uvs: number[] = [];
  const scatter: number[] = [];
  const seeds: number[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = y * w + x;
      // Any cell touching the subject gets a tile; the texture's alpha trims the edge.
      if (alpha[i] < 0.05) continue;

      const px = (x + 0.5 - cx) / span;
      const py = -(y + 0.5 - cy) / span;
      positions.push(px, py, body[i] * bulge + (lumS[i] - 0.5) * relief);
      uvs.push((x + 0.5) / w, 1 - (y + 0.5) / h);

      // Scatter: a burst outward and toward the camera, like shards blown off the photo.
      const a = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 0.9;
      scatter.push(Math.cos(a) * r + px * 0.6, Math.sin(a) * r * 0.7 + py * 0.4, (Math.random() - 0.2) * 1.2);
      seeds.push(Math.random());
    }
  }

  const texture = new THREE.Texture(img);
  // Sampled as-is: the shader outputs the photo's own sRGB values.
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aUv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('aScatter', new THREE.Float32BufferAttribute(scatter, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  g.computeBoundingSphere();
  g.userData = {
    texture,
    /** Grid spacing in local units. */
    pitch: 1 / span,
    /** UV size of one tile. */
    tileUv: [TILE / w, TILE / h],
    levels: [lo, Math.max(0.05, hi - lo), o.brighten ?? 1.0],
  };
  return g;
}

const vertexShader = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform float uSize;
  uniform float uResY;
  uniform float uPush;
  uniform float uRadius;
  uniform vec3 uMouse;
  attribute vec2 aUv;
  attribute vec3 aScatter;
  attribute float aSeed;
  varying vec2 vUv;
  varying float vGrow;
  varying float vAssembled;

  void main() {
    // Tiles land in a staggered order.
    float t = clamp((uProgress - aSeed * 0.35) / 0.65, 0.0, 1.0);
    t = 1.0 - pow(1.0 - t, 3.0);
    vec3 p = mix(position + aScatter, position, t);

    // Cursor pushes tiles aside and toward the viewer.
    vec2 d = p.xy - uMouse.xy;
    float dist = length(d);
    float f = 1.0 - smoothstep(0.0, uRadius, dist);
    f *= f;
    p.xy += (d / max(dist, 1e-4)) * f * uPush;
    p.z += f * uPush * 2.0;

    // Loose tiles drift; assembled ones hold still so the photo stays sharp.
    float loose = 1.0 - t;
    p.x += loose * 0.01 * sin(uTime * 1.3 + aSeed * 40.0);
    p.y += loose * 0.01 * cos(uTime * 1.1 + aSeed * 57.0);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float worldScale = length(modelMatrix[0].xyz);
    float grow = 1.0 + f * 0.25;
    gl_PointSize = uSize * grow * worldScale * projectionMatrix[1][1] * uResY * 0.5 / -mv.z;

    vUv = aUv;
    vGrow = grow;
    vAssembled = t;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uTileUv;
  uniform vec3 uLevels; // low, range, brighten
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vGrow;
  varying float vAssembled;

  void main() {
    // Map this fragment of the square tile onto its patch of the photo.
    vec2 offset = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * uTileUv * vGrow;
    vec4 tex = texture2D(uMap, vUv + offset);
    // The cutout's soft fringe still carries the old background; keep only the solid part.
    if (tex.a < 0.8) discard;

    vec3 c = tex.rgb;
    // Despill: where green dominates (grass showing through hair), pull it to neutral.
    float spill = max(0.0, c.g - max(c.r, c.b));
    c.g -= spill;
    c.g = mix(c.g, (c.r + c.b) * 0.5, step(0.001, spill) * 0.6);
    // Darken what is left of the edge so it blends into hair and shoulders.
    c *= mix(0.55, 1.0, smoothstep(0.8, 1.0, tex.a));
    c = clamp((c - uLevels.x) / uLevels.y, 0.0, 1.0);
    c = pow(c, vec3(0.9)) * uLevels.z;

    gl_FragColor = vec4(c, uOpacity * (0.4 + 0.6 * vAssembled));
  }
`;

export function createPhotoMaterial(geometry: THREE.BufferGeometry) {
  const { texture, pitch, tileUv, levels } = geometry.userData as {
    texture: THREE.Texture;
    pitch: number;
    tileUv: [number, number];
    levels: [number, number, number];
  };
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTileUv: { value: new THREE.Vector2(...tileUv) },
      uLevels: { value: new THREE.Vector3(...levels) },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSize: { value: pitch * TILE },
      uResY: { value: 800 },
      uPush: { value: 0.035 },
      uRadius: { value: 0.08 },
      uMouse: { value: new THREE.Vector3(99, 99, 0) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
  });
}
