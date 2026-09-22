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
/* Cat: the silhouette in public/images/cat.png (226×360 px), hanging  */
/* off a wall by its front paws, with claw scratches above each paw.   */
/* Every part is placed from pixel positions measured in the image.    */
/* ------------------------------------------------------------------ */

const FUR: V3 = [0.66, 0.69, 0.76];
const WHITE_LINE: V3 = [0.96, 0.96, 0.96];
const SCRATCH: V3 = [0.85, 0.82, 0.78];

/** Image pixels → model units (y up, centred on the body). */
const PX = 100;
const CX = 113;
const px = (x: number, y: number, z = 0): V3 => [(x - CX) / PX, (360 - y) / PX, z];

/** The wall the cat hangs on sits just behind it. */
const WALL_Z = -0.36;

/** Point on the front of an ellipsoid (centre and radii in image pixels) under pixel (x, y). */
function onBlob(cx: number, cy: number, rx: number, ry: number, rz: number, x: number, y: number, lift = 0.01): V3 {
  const u = (x - cx) / rx;
  const v = (y - cy) / ry;
  const z = (rz / PX) * Math.sqrt(Math.max(0, 1 - u * u - v * v));
  return px(x, y, z + lift);
}

export function cat() {
  const lb = new LineBuilder();
  const fur = (k: number): Shade => scale(FUR, k);
  const blob = (cx: number, cy: number, rx: number, ry: number, rz: number, rings: number, meridians: number, k: number) =>
    lb.ellipsoid(px(cx, cy), [rx / PX, ry / PX, rz / PX], rings, meridians, fur(k));
  const limb = (points: [number, number, number][], r: (t: number) => number, k = 0.8) =>
    lb.tube(points.map(([x, y, z]) => px(x, y, z)), (t) => r(t) / PX, 18, 7, fur(k));

  // Head (round, slightly wide) and ears pointing up between the raised legs.
  const HEAD = { cx: 113, cy: 140, rx: 33, ry: 27, rz: 28 };
  blob(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, HEAD.rz, 8, 14, 0.6);
  for (const [bx0, bx1, tip] of [[92, 108, 100], [118, 134, 126]] as const) {
    const apex = px(tip, 104, 0.02);
    const a = px(bx0, 118, 0.12);
    const b = px(bx1, 118, 0.12);
    const back = px((bx0 + bx1) / 2, 120, -0.08);
    lb.polyline([a, apex, b], false, fur(1));
    lb.line(apex, back, fur(0.7));
    lb.line(a, back, fur(0.5));
    lb.line(b, back, fur(0.5));
  }

  // Big white eyes looking up, pupils toward the nose.
  const eye = (cx: number, cy: number, pupilX: number) => {
    for (const k of [1, 0.75, 0.5]) {
      const pts: V3[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        pts.push(onBlob(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, HEAD.rz, cx + Math.cos(a) * 8.5 * k, cy + Math.sin(a) * 9 * k, 0.015));
      }
      lb.polyline(pts, false, k === 1 ? WHITE_LINE : scale(WHITE_LINE, 0.7));
    }
    const pupil: V3[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      pupil.push(onBlob(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, HEAD.rz, pupilX + Math.cos(a) * 2, cy - 2 + Math.sin(a) * 2.6, 0.02));
    }
    lb.polyline(pupil, false, WHITE_LINE);
  };
  eye(94, 135, 101);
  eye(130, 137, 124);

  // Whiskers fanning out past the cheeks.
  const whiskers: [number, number, number, number][] = [
    [97, 148, 70, 122], [96, 151, 66, 140], [98, 154, 74, 162],
    [129, 148, 152, 124], [130, 151, 160, 140], [128, 154, 150, 162],
  ];
  for (const [x0, y0, x1, y1] of whiskers) {
    lb.line(onBlob(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, HEAD.rz, x0, y0, 0.01), px(x1, y1, 0.16), scale(WHITE_LINE, 0.75));
  }

  // Long body hanging straight down from the head, as one continuous shape.
  lb.lathe(
    [
      [0, 150], [30, 150], [34, 162], [35, 180], [35, 200], [35, 220], [34, 232], [28, 240], [0, 244],
    ].map(([r, y]) => [r / PX, (360 - y) / PX] as [number, number]),
    12,
    [(114 - CX) / PX, 0, -0.02],
    0.82,
    fur(0.55),
  );

  // Front legs stretched up to the paws gripping the wall.
  limb([[90, 150, 0.05], [83, 112, 0.0], [77, 84, -0.08], [75, 72, -0.14]], (t) => 6 - t * 1.5);
  limb([[137, 150, 0.05], [141, 112, 0.0], [147, 84, -0.08], [150, 72, -0.14]], (t) => 6 - t * 1.5);
  for (const [cx, claws] of [[75, [66, 71, 77, 82]], [150, [142, 147, 152, 158]]] as const) {
    blob(cx, 70, 9, 7, 7, 4, 8, 0.9);
    // White claws hooked into the wall.
    for (const x of claws) lb.polyline([px(x, 66, -0.14), px(x + 0.5, 61, -0.25), px(x + 1, 58, WALL_Z)], false, WHITE_LINE);
  }

  // Scratch marks dragged down the wall above each paw, tapering toward the top.
  for (const [x, top] of [[65, 14], [69, 12], [75, 13], [83, 16], [141, 16], [149, 12], [155, 13], [159, 15]] as const) {
    lb.line(px(x - 0.6, 58, WALL_Z), px(x, top, WALL_Z), SCRATCH);
    lb.line(px(x + 0.6, 58, WALL_Z), px(x, top + 4, WALL_Z), scale(SCRATCH, 0.6));
  }

  // Hind legs dangling, feet turned to show white toe beans.
  limb([[94, 232, 0.02], [89, 262, 0.02], [86, 284, 0.04]], (t) => 7 - t * 2);
  limb([[134, 232, 0.02], [140, 262, 0.02], [143, 284, 0.04]], (t) => 7 - t * 2);
  for (const cx of [86, 143]) {
    blob(cx, 292, 10, 8, 7, 4, 8, 0.9);
    const bean = (x: number, y: number, r: number) => {
      const pts: V3[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        pts.push(px(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.1));
      }
      lb.polyline(pts, false, WHITE_LINE);
    };
    for (const dx of [-6, -2, 2, 6]) bean(cx + dx, 290 + Math.abs(dx) * 0.4, 1.8);
    bean(cx, 297, 3.6);
  }

  // Tail: straight down from the body, then a thick curl to the left.
  limb(
    [[111, 238, -0.02], [111, 256, -0.02], [115, 274, 0], [121, 290, 0.02], [126, 304, 0.03], [124, 318, 0.04], [114, 330, 0.05], [102, 336, 0.05], [96, 330, 0.05]],
    (t) => 4 + Math.pow(t, 2) * 7,
    0.8,
  );
  // Rounded end of the curl.
  blob(110, 330, 16, 11, 10, 4, 10, 0.75);

  return lb.build();
}
