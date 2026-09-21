import * as THREE from 'three';
import { LineBuilder, type Shade, type V3 } from './lines';

const scale = (c: V3, k: number): V3 => [c[0] * k, c[1] * k, c[2] * k];

/* ------------------------------------------------------------------ */
/* Football: the Puma Premier League ball. No pentagons; instead large */
/* hook-shaped swooshes wrap around a white sphere.                    */
/* ------------------------------------------------------------------ */

const VIOLET: V3 = [0.55, 0.45, 1];
const PINK: V3 = [1, 0.42, 0.78];
const CYAN_BALL: V3 = [0.4, 0.85, 1];

export function football() {
  const lb = new LineBuilder();

  // White ball: faint latitude and longitude rings.
  for (let i = 1; i < 8; i++) {
    const lat = -Math.PI / 2 + (i / 8) * Math.PI;
    lb.ellipse([0, Math.sin(lat), 0], Math.cos(lat), Math.cos(lat), 'xz', 64, 0.28);
  }
  for (let j = 0; j < 8; j++) {
    const lon = (j / 8) * Math.PI;
    const pts: V3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push([Math.cos(a) * Math.cos(lon), Math.sin(a), Math.cos(a) * Math.sin(lon)]);
    }
    lb.polyline(pts, true, 0.2);
  }

  // One hook per icosahedron vertex, each spun to a different angle.
  const phi = (1 + Math.sqrt(5)) / 2;
  const centres = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());

  centres.forEach((n, index) => {
    const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u0 = new THREE.Vector3().crossVectors(n, up).normalize();
    const v0 = new THREE.Vector3().crossVectors(n, u0);
    const spin = index * 2.39; // golden-angle spread so no two hooks line up
    const u = u0.clone().multiplyScalar(Math.cos(spin)).addScaledVector(v0, Math.sin(spin));
    const v = new THREE.Vector3().crossVectors(n, u);
    const onBall = (a: number, b: number, lift = 1.004): V3 => {
      const p = n.clone().addScaledVector(u, a).addScaledVector(v, b).normalize().multiplyScalar(lift);
      return [p.x, p.y, p.z];
    };

    // Centreline: a 210° arc that runs straight out at one end, like a "J".
    const R = 0.34;
    const centre: [number, number][] = [];
    const tangent: [number, number][] = [];
    const arcSteps = 28;
    for (let i = 0; i <= arcSteps; i++) {
      const t = (i / arcSteps) * 3.7;
      centre.push([Math.cos(t) * R, Math.sin(t) * R]);
      tangent.push([-Math.sin(t), Math.cos(t)]);
    }
    const [ex, ey] = centre[centre.length - 1];
    const [tx, ty] = tangent[tangent.length - 1];
    for (let i = 1; i <= 6; i++) {
      centre.push([ex + tx * 0.05 * i, ey + ty * 0.05 * i]);
      tangent.push([tx, ty]);
    }

    // Band edges: rounded head, tapering to a point at the tail.
    const band = (offset: number) =>
      centre.map(([cx, cy], i) => {
        const f = i / (centre.length - 1);
        const width = 0.11 * Math.min(1, (1 - f) * 3.5) * Math.min(1, 0.35 + f * 4);
        const [nx, ny] = [-tangent[i][1], tangent[i][0]];
        return onBall(cx + nx * width * offset, cy + ny * width * offset);
      });

    const outer = band(1);
    const inner = band(-1);
    lb.polyline([...outer, ...inner.reverse()], true, VIOLET);
    // Inner colour sweeps, alternating pink and cyan like the printed gradient.
    const accent = index % 2 === 0 ? PINK : CYAN_BALL;
    lb.polyline(band(0.7), false, scale(VIOLET, 0.8));
    lb.polyline(band(0.35), false, accent);
    lb.polyline(band(0), false, accent);
    lb.polyline(band(-0.4), false, scale(accent, 0.7));
    // Short "flick" beside each hook.
    const fx: V3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = -0.6 + (i / 8) * 0.9;
      fx.push(onBall(Math.cos(t) * (R + 0.16), Math.sin(t) * (R + 0.16)));
    }
    lb.polyline(fx, false, scale(VIOLET, 0.8));
  });

  return lb.build();
}

/* ------------------------------------------------------------------ */
/* Jiji: big round head, huge eyes, tall ears, a slim seated body and  */
/* a long tail curling round to the side.                              */
/* ------------------------------------------------------------------ */

const BODY: V3 = [1, 0.84, 0.04];
const EYE: V3 = [0.96, 0.98, 0.92];
const INNER_EAR: V3 = [0.78, 0.6, 1];
const NOSE: V3 = [1, 0.55, 0.68];

export function cat() {
  const lb = new LineBuilder();
  const body = (k: number): Shade => scale(BODY, k);

  // Slim seated body leaning back slightly, with a rounded chest.
  lb.setTransform([0, 0, -0.05], [0.12, 0, 0]);
  lb.lathe(
    [
      [0.0, 0.0], [0.36, 0.02], [0.46, 0.18], [0.48, 0.45], [0.42, 0.8], [0.33, 1.1],
      [0.26, 1.35], [0.22, 1.6], [0.2, 1.75], [0.0, 1.8],
    ],
    12,
    [0, 0, 0],
    0.9,
    body(0.6),
  );
  lb.resetTransform();
  lb.ellipsoid([0, 1.05, 0.24], [0.3, 0.45, 0.24], 5, 10, body(0.45));

  // Haunches, thin front legs and small paws.
  for (const s of [-1, 1]) {
    lb.ellipsoid([s * 0.34, 0.32, -0.08], [0.2, 0.32, 0.38], 5, 9, body(0.55));
    lb.tube([[s * 0.13, 1.1, 0.3], [s * 0.14, 0.55, 0.38], [s * 0.13, 0.06, 0.4]], () => 0.065, 12, 6, body(0.8));
    lb.ellipsoid([s * 0.13, 0.04, 0.47], [0.08, 0.05, 0.11], 3, 8, body(0.8));
  }

  // Everything on the head sits low, right on the shoulders.
  lb.setTransform([0, -0.2, 0]);

  // Big head.
  lb.ellipsoid([0, 2.15, 0.05], [0.6, 0.52, 0.5], 8, 14, body(0.55));

  // Tall ears with lavender insides.
  for (const s of [-1, 1]) {
    const apex: V3 = [s * 0.5, 3.1, -0.02];
    const base: V3[] = [[s * 0.14, 2.6, 0.22], [s * 0.6, 2.35, 0.08], [s * 0.36, 2.5, -0.25]];
    base.forEach((b) => lb.line(apex, b, body(1)));
    lb.polyline(base, true, body(0.9));
    lb.polyline([[s * 0.47, 2.94, 0.04], [s * 0.22, 2.62, 0.2], [s * 0.53, 2.44, 0.12]], true, INNER_EAR);
    lb.polyline([[s * 0.44, 2.84, 0.07], [s * 0.3, 2.63, 0.17], [s * 0.49, 2.53, 0.12]], true, scale(INNER_EAR, 0.7));
  }

  // Huge eyes set on the curve of the face, with small oval pupils.
  for (const s of [-1, 1]) {
    const yaw = 0.42;
    const c: V3 = [s * 0.25, 2.2, 0.47];
    const tangent: V3 = [Math.cos(yaw), 0, -s * Math.sin(yaw)];
    const at = (lx: number, ly: number): V3 => [c[0] + tangent[0] * lx, c[1] + ly, c[2] + tangent[2] * lx];
    const ring = (rx: number, ry: number, ox = 0, oy = 0, shade: Shade = EYE) => {
      const pts: V3[] = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        pts.push(at(ox + Math.cos(a) * rx, oy + Math.sin(a) * ry));
      }
      lb.polyline(pts, true, shade);
    };
    ring(0.17, 0.2);
    ring(0.155, 0.185, 0, 0, scale(EYE, 0.6));
    for (const k of [1, 0.66, 0.33]) ring(0.035 * k, 0.06 * k, s * -0.015, 0.0, EYE);
  }

  // Tiny nose, mouth and whiskers.
  lb.polyline([[-0.045, 2.03, 0.52], [0.045, 2.03, 0.52], [0, 1.99, 0.53]], true, NOSE);
  lb.polyline([[0, 1.99, 0.53], [0, 1.95, 0.52], [-0.05, 1.93, 0.5]], false, body(0.8));
  lb.line([0, 1.95, 0.52], [0.05, 1.93, 0.5], body(0.8));
  for (const s of [-1, 1]) {
    lb.line([s * 0.14, 2.0, 0.47], [s * 0.6, 2.07, 0.36], body(0.5));
    lb.line([s * 0.14, 1.97, 0.47], [s * 0.58, 1.95, 0.36], body(0.5));
  }

  lb.resetTransform();

  // Long tail sweeping out to the left and curling up.
  lb.tube(
    [[0, 0.12, -0.38], [-0.45, 0.08, -0.42], [-0.85, 0.1, -0.1], [-1.05, 0.2, 0.25], [-1.1, 0.45, 0.45], [-0.95, 0.62, 0.5]],
    (t) => 0.06 - t * 0.02,
    36,
    6,
    body(0.8),
  );

  return lb.build();
}
