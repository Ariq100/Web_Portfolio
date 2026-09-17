import * as THREE from 'three';
import { LineBuilder, type V3 } from './lines';

/* ------------------------------------------------------------------ */
/* Soccer ball: truncated icosahedron projected onto a sphere.         */
/* ------------------------------------------------------------------ */

export function soccerBall() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const ico: THREE.Vector3[] = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const edgeLen = 2;

  // Cut every icosahedron edge at 1/3 and 2/3.
  const verts: THREE.Vector3[] = [];
  const pentagons: THREE.Vector3[][] = ico.map(() => []);
  for (let i = 0; i < ico.length; i++) {
    for (let j = i + 1; j < ico.length; j++) {
      if (Math.abs(ico[i].distanceTo(ico[j]) - edgeLen) > 1e-6) continue;
      const a = ico[i].clone().lerp(ico[j], 1 / 3);
      const b = ico[i].clone().lerp(ico[j], 2 / 3);
      verts.push(a, b);
      pentagons[i].push(a);
      pentagons[j].push(b);
    }
  }

  const lb = new LineBuilder();
  const onSphere = (v: THREE.Vector3): V3 => {
    const n = v.clone().normalize();
    return [n.x, n.y, n.z];
  };
  const arc = (a: THREE.Vector3, b: THREE.Vector3, brightness = 1, steps = 6) => {
    const pts: V3[] = [];
    for (let s = 0; s <= steps; s++) pts.push(onSphere(a.clone().lerp(b, s / steps)));
    lb.polyline(pts, false, brightness);
  };

  // All truncated-icosahedron edges share one length: connect those pairs.
  const target = verts[0].distanceTo(verts[1]);
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (Math.abs(verts[i].distanceTo(verts[j]) - target) < 1e-4) arc(verts[i], verts[j]);
    }
  }

  // Dark pentagon panels: nested outlines so they read as filled patches.
  ico.forEach((center, i) => {
    const pts = pentagons[i];
    const c = center.clone().multiplyScalar(0.7);
    const sorted = sortAround(pts, center);
    for (const inset of [0.72, 0.46, 0.22]) {
      const ring = sorted.map((p) => p.clone().lerp(c, 1 - inset));
      for (let k = 0; k < ring.length; k++) arc(ring[k], ring[(k + 1) % ring.length], 0.75, 4);
    }
  });

  // A couple of faint latitude rings give the sphere volume.
  for (const lat of [-0.5, 0, 0.5]) lb.ellipse([0, Math.sin(lat), 0], Math.cos(lat), Math.cos(lat), 'xz', 48, 0.25);
  return lb.build();
}

function sortAround(points: THREE.Vector3[], axis: THREE.Vector3) {
  const n = axis.clone().normalize();
  const u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  return [...points].sort((a, b) => Math.atan2(a.dot(v), a.dot(u)) - Math.atan2(b.dot(v), b.dot(u)));
}

/* ------------------------------------------------------------------ */
/* Sitting cat built from rings and meridians.                         */
/* ------------------------------------------------------------------ */

export function cat() {
  const lb = new LineBuilder();

  // Body: pear-shaped, chest pushed forward under the head.
  lb.setTransform([0, 0, -0.12], [0.2, 0, 0]);
  lb.lathe(
    [
      [0.0, 0.0], [0.46, 0.02], [0.64, 0.14], [0.72, 0.36], [0.7, 0.6], [0.62, 0.84],
      [0.52, 1.06], [0.42, 1.26], [0.34, 1.44], [0.27, 1.58], [0.0, 1.66],
    ],
    12,
    [0, 0, 0],
    0.85,
  );
  lb.resetTransform();

  // Haunches.
  lb.ellipsoid([0.46, 0.36, -0.12], [0.3, 0.36, 0.48], 6, 10, 0.9);
  lb.ellipsoid([-0.46, 0.36, -0.12], [0.3, 0.36, 0.48], 6, 10, 0.9);

  // Front legs and paws.
  for (const side of [-1, 1]) {
    lb.tube([[0.22 * side, 1.2, 0.42], [0.23 * side, 0.62, 0.62], [0.22 * side, 0.08, 0.68]], (t) => 0.11 - t * 0.02, 10, 6);
    lb.ellipsoid([0.22 * side, 0.06, 0.78], [0.12, 0.07, 0.17], 4, 8);
  }

  // Head.
  const head: V3 = [0, 1.95, 0.3];
  lb.ellipsoid(head, [0.44, 0.37, 0.38], 7, 12);
  lb.ellipsoid([0, 1.83, 0.48], [0.17, 0.12, 0.13], 4, 8); // muzzle

  // Ears.
  for (const side of [-1, 1]) {
    const apex: V3 = [0.3 * side, 2.55, 0.12];
    const base: V3[] = [
      [0.1 * side, 2.26, 0.22],
      [0.42 * side, 2.12, 0.2],
      [0.3 * side, 2.2, -0.02],
    ];
    base.forEach((b) => lb.line(apex, b));
    lb.polyline(base, true);
    lb.line([0.29 * side, 2.46, 0.16], [0.22 * side, 2.24, 0.24], 0.6); // inner ear
  }

  // Eyes with slit pupils.
  for (const side of [-1, 1]) {
    const c: V3 = [0.16 * side, 2.0, 0.53];
    const eye: V3[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      eye.push([c[0] + Math.cos(a) * 0.085, c[1] + Math.sin(a) * 0.05 * (1 - 0.3 * Math.abs(Math.cos(a))), c[2]]);
    }
    lb.polyline(eye, true);
    lb.line([c[0], c[1] + 0.045, c[2] + 0.005], [c[0], c[1] - 0.045, c[2] + 0.005]);
  }

  // Nose, mouth, whiskers.
  lb.polyline([[-0.05, 1.89, 0.6], [0.05, 1.89, 0.6], [0, 1.84, 0.61]], true);
  lb.polyline([[0, 1.84, 0.61], [0, 1.79, 0.6], [-0.06, 1.76, 0.58]]);
  lb.line([0, 1.79, 0.6], [0.06, 1.76, 0.58]);
  for (const side of [-1, 1]) {
    for (const [dy, dz] of [[0.04, 0], [0, 0.01], [-0.04, 0.02]]) {
      lb.line([0.12 * side, 1.82 + dy * 0.3, 0.58], [0.58 * side, 1.84 + dy * 2, 0.45 + dz], 0.7);
    }
  }

  // Tail curling around the front paws.
  lb.tube(
    [[0, 0.2, -0.62], [0.45, 0.06, -0.72], [0.82, 0.06, -0.25], [0.78, 0.06, 0.3], [0.48, 0.08, 0.7]],
    (t) => 0.1 - t * 0.04,
    30,
    6,
  );

  return lb.build();
}

/* ------------------------------------------------------------------ */
/* Cars: lofted cross-sections along the length, with cut-out arches.  */
/* ------------------------------------------------------------------ */

interface Station {
  x: number;
  hw: number; // half width at the shoulder
  bottom: number;
  belt: number; // shoulder / fender height
  roof: number; // height at the edge of the roof (or hood)
  roofHw: number; // half width of the roof (or hood)
  crown?: number; // extra height at the centreline
}

interface Wheel {
  x: number;
  r: number;
  spokes: number;
}

function catmull(values: number[], t: number) {
  const n = values.length;
  const i = Math.min(n - 2, Math.max(0, Math.floor(t)));
  const f = t - i;
  const p0 = values[Math.max(0, i - 1)];
  const p1 = values[i];
  const p2 = values[i + 1];
  const p3 = values[Math.min(n - 1, i + 2)];
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
}

function loftCar(lb: LineBuilder, stations: Station[], wheels: Wheel[], rings = 44) {
  const key = <K extends keyof Station>(k: K) => stations.map((s) => (s[k] as number | undefined) ?? 0);
  const cols = {
    x: key('x'), hw: key('hw'), bottom: key('bottom'), belt: key('belt'),
    roof: key('roof'), roofHw: key('roofHw'), crown: key('crown'),
  };

  const sections: V3[][] = [];
  for (let k = 0; k <= rings; k++) {
    const t = (k / rings) * (stations.length - 1);
    const s = Object.fromEntries(Object.entries(cols).map(([name, v]) => [name, catmull(v, t)])) as unknown as Station;
    const crown = s.crown ?? 0;
    const lift = Math.max(0, s.roof - s.belt);
    // One side, bottom centre → top centre.
    const half: [number, number][] = [
      [0, s.bottom],
      [s.hw * 0.9, s.bottom],
      [s.hw, s.bottom + (s.belt - s.bottom) * 0.4],
      [s.hw * 0.995, s.belt],
      [s.roofHw + (s.hw - s.roofHw) * 0.55, s.belt + lift * 0.1],
      [s.roofHw, s.roof],
      [s.roofHw * 0.5, s.roof + crown * 0.8],
      [0, s.roof + crown],
    ];
    const full: V3[] = [
      ...half.map(([z, y]) => [s.x, y, z] as V3),
      ...half.slice(0, -1).reverse().map(([z, y]) => [s.x, y, -z] as V3),
    ];
    sections.push(full);
  }

  const inArch = (p: V3) =>
    wheels.some((w) => Math.hypot(p[0] - w.x, p[1] - w.r) < w.r + 0.07 && Math.abs(p[2]) > 0.3);

  const segment = (a: V3, b: V3, brightness = 1) => {
    if (inArch(a) && inArch(b)) return;
    lb.line(a, b, brightness);
  };

  sections.forEach((ring, k) => {
    // Every other cross-section keeps the mesh readable.
    if (k % 2 === 0 || k === sections.length - 1) {
      for (let i = 0; i < ring.length - 1; i++) segment(ring[i], ring[i + 1], 0.8);
    }
    if (k < sections.length - 1) {
      for (let i = 0; i < ring.length; i++) segment(ring[i], sections[k + 1][i], 1);
    }
  });
  // Close the nose and tail.
  for (const ring of [sections[0], sections[sections.length - 1]]) {
    for (let i = 1; i < ring.length / 2; i++) lb.line(ring[i], ring[ring.length - i], 0.5);
  }

  // Wheels, tyres and arch outlines.
  const widthAt = (x: number) => {
    const t = Math.max(0, Math.min(stations.length - 1, stations.findIndex((s) => s.x >= x) - 0.5));
    return catmull(cols.hw, t);
  };
  for (const w of wheels) {
    const hw = widthAt(w.x);
    for (const side of [-1, 1]) {
      const zOut = side * (hw - 0.06);
      const zIn = side * (hw - 0.3);
      lb.ellipse([w.x, w.r, zOut], w.r, w.r, 'xy', 28);
      lb.ellipse([w.x, w.r, zIn], w.r, w.r, 'xy', 28, 0.6);
      lb.ellipse([w.x, w.r, zOut], w.r * 0.64, w.r * 0.64, 'xy', 24, 0.9);
      lb.ellipse([w.x, w.r, zOut], w.r * 0.14, w.r * 0.14, 'xy', 10, 0.9);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        lb.line(
          [w.x + Math.cos(a) * w.r, w.r + Math.sin(a) * w.r, zOut],
          [w.x + Math.cos(a) * w.r, w.r + Math.sin(a) * w.r, zIn],
          0.45,
        );
      }
      for (let i = 0; i < w.spokes; i++) {
        const a = (i / w.spokes) * Math.PI * 2;
        const b = a + 0.22;
        lb.polyline(
          [
            [w.x + Math.cos(a) * w.r * 0.14, w.r + Math.sin(a) * w.r * 0.14, zOut],
            [w.x + Math.cos(a) * w.r * 0.62, w.r + Math.sin(a) * w.r * 0.62, zOut],
            [w.x + Math.cos(b) * w.r * 0.62, w.r + Math.sin(b) * w.r * 0.62, zOut],
            [w.x + Math.cos(b) * w.r * 0.14, w.r + Math.sin(b) * w.r * 0.14, zOut],
          ],
          false,
          0.9,
        );
      }
      // Wheel arch lip.
      const arch: V3[] = [];
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * Math.PI;
        arch.push([w.x + Math.cos(a) * (w.r + 0.07), w.r + Math.sin(a) * (w.r + 0.07), side * hw]);
      }
      lb.polyline(arch);
    }
  }
}

export function porsche930() {
  const lb = new LineBuilder();
  // x: rear (0) → front (4.29). Units ≈ metres.
  loftCar(
    lb,
    [
      { x: 0.0, hw: 0.74, bottom: 0.3, belt: 0.62, roof: 0.66, roofHw: 0.62 },
      { x: 0.22, hw: 0.86, bottom: 0.24, belt: 0.78, roof: 0.84, roofHw: 0.66, crown: 0.02 },
      { x: 0.75, hw: 0.9, bottom: 0.22, belt: 0.8, roof: 0.96, roofHw: 0.62, crown: 0.03 },
      { x: 1.3, hw: 0.88, bottom: 0.22, belt: 0.82, roof: 1.2, roofHw: 0.56, crown: 0.03 },
      { x: 1.8, hw: 0.85, bottom: 0.22, belt: 0.83, roof: 1.28, roofHw: 0.56, crown: 0.03 },
      { x: 2.35, hw: 0.84, bottom: 0.22, belt: 0.82, roof: 1.27, roofHw: 0.57, crown: 0.03 },
      { x: 2.65, hw: 0.84, bottom: 0.22, belt: 0.8, roof: 0.98, roofHw: 0.66, crown: 0.02 },
      { x: 2.85, hw: 0.84, bottom: 0.22, belt: 0.79, roof: 0.78, roofHw: 0.62, crown: 0.02 },
      // Front: fenders stand proud of a low bonnet.
      { x: 3.4, hw: 0.84, bottom: 0.22, belt: 0.76, roof: 0.72, roofHw: 0.48, crown: 0.02 },
      { x: 3.95, hw: 0.81, bottom: 0.22, belt: 0.72, roof: 0.6, roofHw: 0.42, crown: 0.02 },
      { x: 4.29, hw: 0.66, bottom: 0.26, belt: 0.5, roof: 0.47, roofHw: 0.36 },
    ],
    [
      { x: 0.95, r: 0.32, spokes: 5 },
      { x: 3.22, r: 0.31, spokes: 5 },
    ],
  );

  // Whale-tail spoiler with its raised rubber lip and grille slats.
  const y = 1.0;
  lb.polyline([[0.02, y, -0.8], [0.6, y - 0.03, -0.78], [0.6, y - 0.03, 0.78], [0.02, y, 0.8]], true);
  lb.polyline([[-0.02, y + 0.07, -0.82], [-0.02, y + 0.07, 0.82]]);
  lb.line([-0.02, y + 0.07, -0.82], [0.02, y, -0.8]);
  lb.line([-0.02, y + 0.07, 0.82], [0.02, y, 0.8]);
  for (let i = 1; i < 8; i++) {
    const z = -0.6 + (i / 8) * 1.2;
    lb.line([0.12, y - 0.005, z], [0.5, y - 0.025, z], 0.6);
  }
  for (const z of [-0.5, 0.5]) lb.line([0.3, y - 0.02, z], [0.3, 0.84, z], 0.6);

  // Round headlights on top of the front fenders.
  for (const side of [-1, 1]) {
    lb.ellipse([4.02, 0.7, side * 0.6], 0.1, 0.1, 'yz', 18);
    lb.ellipse([4.03, 0.7, side * 0.6], 0.06, 0.06, 'yz', 12, 0.7);
    // Side mirror.
    lb.polyline([[2.62, 0.9, side * 0.86], [2.55, 0.95, side * 1.0], [2.45, 0.93, side * 1.0], [2.5, 0.88, side * 0.86]], true);
    // Door shut line.
    lb.polyline([[2.6, 0.26, side * 0.85], [2.62, 0.8, side * 0.85]], false, 0.6);
    lb.polyline([[1.55, 0.26, side * 0.88], [1.5, 0.8, side * 0.87]], false, 0.6);
  }
  // Full-width tail-light bar and impact bumpers.
  lb.polyline([[0.01, 0.58, -0.7], [0.01, 0.58, 0.7], [0.01, 0.66, 0.7], [0.01, 0.66, -0.7]], true);
  lb.polyline([[-0.04, 0.3, -0.72], [-0.04, 0.3, 0.72], [-0.04, 0.42, 0.72], [-0.04, 0.42, -0.72]], true, 0.7);
  lb.polyline([[4.32, 0.3, -0.64], [4.32, 0.3, 0.64], [4.32, 0.42, 0.64], [4.32, 0.42, -0.64]], true, 0.7);
  return lb.build();
}

export function astonVanquish() {
  const lb = new LineBuilder();
  // x: rear (0) → front (4.85). Long bonnet, cabin set far back, Kamm tail.
  loftCar(
    lb,
    [
      { x: 0.0, hw: 0.84, bottom: 0.34, belt: 0.86, roof: 0.92, roofHw: 0.74 },
      { x: 0.28, hw: 0.95, bottom: 0.26, belt: 0.9, roof: 0.96, roofHw: 0.7, crown: 0.02 },
      { x: 0.85, hw: 1.0, bottom: 0.24, belt: 0.86, roof: 1.08, roofHw: 0.56, crown: 0.03 },
      { x: 1.4, hw: 0.99, bottom: 0.24, belt: 0.82, roof: 1.24, roofHw: 0.55, crown: 0.03 },
      { x: 1.9, hw: 0.97, bottom: 0.24, belt: 0.8, roof: 1.29, roofHw: 0.56, crown: 0.03 },
      { x: 2.3, hw: 0.96, bottom: 0.24, belt: 0.78, roof: 1.2, roofHw: 0.6, crown: 0.03 },
      { x: 2.75, hw: 0.95, bottom: 0.24, belt: 0.76, roof: 0.84, roofHw: 0.74, crown: 0.02 },
      { x: 3.4, hw: 0.96, bottom: 0.24, belt: 0.74, roof: 0.78, roofHw: 0.68, crown: 0.04 },
      { x: 4.1, hw: 0.93, bottom: 0.24, belt: 0.7, roof: 0.7, roofHw: 0.62, crown: 0.03 },
      { x: 4.6, hw: 0.86, bottom: 0.24, belt: 0.6, roof: 0.58, roofHw: 0.56, crown: 0.02 },
      { x: 4.85, hw: 0.68, bottom: 0.26, belt: 0.45, roof: 0.45, roofHw: 0.46 },
    ],
    [
      { x: 1.05, r: 0.36, spokes: 10 },
      { x: 3.93, r: 0.35, spokes: 10 },
    ],
  );

  // Signature wide grille with horizontal vanes.
  const grille: V3[] = [[4.87, 0.28, -0.42], [4.87, 0.28, 0.42], [4.83, 0.52, 0.5], [4.83, 0.52, -0.5]];
  lb.polyline(grille, true);
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const y = 0.28 + t * 0.24;
    const hw = 0.42 + t * 0.08;
    lb.line([4.86, y, -hw], [4.86, y, hw], 0.6);
  }
  for (const side of [-1, 1]) {
    // Swept headlights.
    lb.polyline([[4.72, 0.55, side * 0.56], [4.66, 0.6, side * 0.8], [4.5, 0.64, side * 0.9], [4.56, 0.58, side * 0.84], [4.7, 0.53, side * 0.62]], true);
    // Side strake behind the front wheel.
    lb.polyline([[3.35, 0.42, side * 0.965], [3.1, 0.58, side * 0.965], [3.25, 0.62, side * 0.96]], false, 0.8);
    // Side mirror.
    lb.polyline([[2.7, 0.86, side * 0.94], [2.62, 0.92, side * 1.1], [2.5, 0.9, side * 1.1], [2.56, 0.84, side * 0.94]], true);
    lb.polyline([[2.72, 0.26, side * 0.95], [2.72, 0.76, side * 0.95]], false, 0.6);
  }
  // Ducktail lip and blade tail-light.
  lb.polyline([[-0.03, 0.97, -0.72], [-0.03, 0.97, 0.72]]);
  lb.polyline([[0.0, 0.8, -0.82], [0.0, 0.8, 0.82], [0.0, 0.84, 0.82], [0.0, 0.84, -0.82]], true);
  lb.polyline([[-0.02, 0.34, -0.5], [-0.02, 0.34, 0.5]], false, 0.6);
  return lb.build();
}
