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
