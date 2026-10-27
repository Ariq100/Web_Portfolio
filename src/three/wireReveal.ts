import * as THREE from 'three';
import { WIREFRAME_DRAW, wireEdgeStart } from '../wireframeMotion';

/** Grow each edge from a nearby seed, just like the wireframe section titles. */
export function createWireReveal(source: THREE.BufferGeometry, color: THREE.Color) {
  const positions = source.getAttribute('position');
  const colors = source.getAttribute('color');
  const point = (index: number) => new THREE.Vector3().fromBufferAttribute(positions, index);
  const seeds = [point(0)];
  // Spread the three sparks across the model, including long, thin models.
  while (seeds.length < 3) {
    let farthest = 0;
    let maxDistance = -1;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);
      const distance = Math.min(...seeds.map((seed) => vertex.distanceToSquared(seed)));
      if (distance > maxDistance) { maxDistance = distance; farthest = i; }
    }
    seeds.push(point(farthest));
  }
  const distance = (vertex: THREE.Vector3) => Math.sqrt(Math.min(...seeds.map((seed) => vertex.distanceToSquared(seed))));
  const distances = new Float32Array(positions.count);
  let longest = 0;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    distances[i] = distance(vertex.fromBufferAttribute(positions, i));
    longest = Math.max(longest, distances[i]);
  }
  const origins = new Float32Array(positions.count * 3);
  const starts = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i += 2) {
    vertex.fromBufferAttribute(positions, distances[i] <= distances[i + 1] ? i : i + 1);
    vertex.toArray(origins, i * 3);
    vertex.toArray(origins, (i + 1) * 3);
    const shaded = colors ? (colors.getX(i) + colors.getY(i) + colors.getZ(i)) / 3 < 0.4 : false;
    starts[i] = starts[i + 1] = wireEdgeStart(Math.min(distances[i], distances[i + 1]) / Math.max(longest, 1e-6), shaded);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positions);
  if (colors) geometry.setAttribute('color', colors);
  geometry.setAttribute('aOrigin', new THREE.BufferAttribute(origins, 3));
  geometry.setAttribute('aStart', new THREE.BufferAttribute(starts, 1));
  geometry.boundingBox = source.boundingBox?.clone() ?? null;
  geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: color } },
    vertexShader: `
      uniform float uProgress;
      attribute vec3 aOrigin;
      attribute float aStart;
      varying vec3 vColor;
      varying float vDrawn;
      void main() {
        float drawn = smoothstep(0.0, 1.0, (uProgress - aStart) / ${WIREFRAME_DRAW.duration});
        vDrawn = drawn;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(aOrigin, position, drawn), 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vColor;
      varying float vDrawn;
      void main() {
        if (vDrawn < 0.001) discard;
        gl_FragColor = vec4(uColor * vColor, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(seeds.flatMap((seed) => seed.toArray()), 3));
  const sparkMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: `
      uniform float uProgress;
      uniform float uPixelRatio;
      varying float vSpark;
      void main() {
        vSpark = smoothstep(0.0, 0.2, uProgress);
        float settled = smoothstep(0.78, 1.0, uProgress);
        gl_PointSize = max(1.0, 22.0 * uPixelRatio * vSpark * (1.0 - settled * 0.65));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vSpark;
      void main() {
        vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
        float rays = max(exp(-p.x * 30.0) * (1.0 - p.y), exp(-p.y * 30.0) * (1.0 - p.x));
        float halo = exp(-dot(p, p) * 7.0) * 0.28;
        float alpha = (rays + halo) * uOpacity * vSpark;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(mix(vec3(0.196, 0.843, 0.294), vec3(0.9), rays), alpha);
      }
    `,
  });
  return { geometry, material, sparkGeometry, sparkMaterial };
}
