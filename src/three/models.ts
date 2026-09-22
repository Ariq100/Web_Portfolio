import * as THREE from 'three';
import { LineBuilder, type V3 } from './lines';

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
