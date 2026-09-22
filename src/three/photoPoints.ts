import * as THREE from 'three';

export interface PhotoPointsOptions {
  /** Width of the particle grid; one particle per opaque cell. */
  width?: number;
}

/** How much larger than the grid spacing each tile is, so neighbours overlap into a solid image. */
const TILE = 2.2;

/**
 * Builds the home portrait from a transparent PNG/WebP.
 *
 * Two pieces share one full-resolution texture:
 *  - a grid of particles, each a square tile showing its own patch of the photo, used
 *    only while the portrait flies together on load and scatters on scroll;
 *  - a flat image plane that shows the photo exactly as supplied (smooth edges, true
 *    colours) once the tiles have landed. The cursor cuts a gap in this plane.
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
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3] / 255;

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
      positions.push(px, py, 0);
      uvs.push((x + 0.5) / w, 1 - (y + 0.5) / h);

      // Scatter: a burst outward and toward the camera, like shards blown off the photo.
      const a = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 0.9;
      scatter.push(Math.cos(a) * r + px * 0.6, Math.sin(a) * r * 0.7 + py * 0.4, (Math.random() - 0.2) * 1.2);
      seeds.push(Math.random());
    }
  }

  const texture = new THREE.Texture(img);
  // Sampled as-is: the shaders output the photo's own sRGB values.
  texture.colorSpace = THREE.NoColorSpace;
  // Premultiplied alpha + mipmaps keep the cut-out edge smooth at any display size.
  texture.premultiplyAlpha = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
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
    /** The full image as a plane in the same local units as the tiles. */
    plane: { width: w / span, height: h / span, x: (w / 2 - cx) / span, y: -(h / 2 - cy) / span },
  };
  return g;
}

const vertexShader = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform float uSize;
  uniform float uResY;
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

    // Loose tiles drift; assembled ones hold still so the photo stays sharp.
    float loose = 1.0 - t;
    p.x += loose * 0.01 * sin(uTime * 1.3 + aSeed * 40.0);
    p.y += loose * 0.01 * cos(uTime * 1.1 + aSeed * 57.0);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float worldScale = length(modelMatrix[0].xyz);
    float grow = 1.0;
    gl_PointSize = uSize * grow * worldScale * projectionMatrix[1][1] * uResY * 0.5 / -mv.z;

    vUv = aUv;
    vGrow = grow;
    vAssembled = t;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uTileUv;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vGrow;
  varying float vAssembled;

  void main() {
    // Map this fragment of the square tile onto its patch of the photo.
    vec2 offset = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * uTileUv * vGrow;
    vec4 tex = texture2D(uMap, vUv + offset); // premultiplied
    float a = tex.a * uOpacity * (0.4 + 0.6 * vAssembled);
    if (a < 0.003) discard;
    gl_FragColor = vec4(tex.rgb * uOpacity * (0.4 + 0.6 * vAssembled), a);
  }
`;

const planeVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const planeFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uTear;  // the background tear canvas: alpha 0 where ripped
  uniform vec2 uViewport;   // drawing-buffer size in px
  uniform float uOpacity;
  varying vec2 vUv;

  const float BG_LUMA = 0.118; // #1e1e1e, the untorn terminal background

  void main() {
    vec4 tex = texture2D(uMap, vUv); // premultiplied
    // Rip the photo exactly where the background is ripped.
    vec4 tear = texture2D(uTear, gl_FragCoord.xy / uViewport);
    float keep = smoothstep(0.05, 0.6, tear.a);
    // The tear canvas darkens the surface around each rip (lifted-edge shadow);
    // carry that shadow onto the photo.
    float luma = dot(tear.rgb, vec3(0.2126, 0.7152, 0.0722));
    float lip = clamp(luma / BG_LUMA, 0.3, 1.0);
    // The photo is cropped flat at the bottom; fade that edge into the background.
    float fade = smoothstep(0.0, 0.14, vUv.y);
    keep *= fade;
    float a = tex.a * keep * uOpacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(tex.rgb * keep * lip * uOpacity, a);
  }
`;

interface PhotoData {
  texture: THREE.Texture;
  pitch: number;
  tileUv: [number, number];
  plane: { width: number; height: number; x: number; y: number };
}

export function createPhotoMaterial(geometry: THREE.BufferGeometry) {
  const { texture, pitch, tileUv } = geometry.userData as PhotoData;
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTileUv: { value: new THREE.Vector2(...tileUv) },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSize: { value: pitch * TILE },
      uResY: { value: 800 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
}

/** The sharp, full-resolution photo shown once the tiles have assembled. */
export function createPhotoPlane(geometry: THREE.BufferGeometry, tear: THREE.Texture) {
  const { texture, plane } = geometry.userData as PhotoData;
  const planeGeometry = new THREE.PlaneGeometry(plane.width, plane.height);
  planeGeometry.translate(plane.x, plane.y, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTear: { value: tear },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uOpacity: { value: 0 },
    },
    vertexShader: planeVertexShader,
    fragmentShader: planeFragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
  return { geometry: planeGeometry, material };
}
