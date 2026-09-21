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
/* Cat: a 3D bust of the chunky black cat in public/images/cat.png.    */
/* Silhouette, eyes, nose, mouth and whiskers are measured from the    */
/* image (857×1200 px) and projected onto a soft, squarish body.       */
/* ------------------------------------------------------------------ */

const FUR: V3 = [0.62, 0.65, 0.72];
const GOLD: V3 = [1, 0.78, 0.22];
const AMBER_DARK: V3 = [0.95, 0.52, 0.12];
const WHITE_LINE: V3 = [0.95, 0.95, 0.95];

/** Image pixels → model units (y up, centred on the face). */
const PX = 400;
const CX = 430;
const toX = (x: number) => (x - CX) / PX;
const toY = (y: number) => (1200 - y) / PX;

/** Left/right outline of the body per image row, measured from the PNG's alpha. */
const OUTLINE: [number, number, number][] = [
  // y, left x, right x — the top rows round the crown between the ears.
  [366, 392, 468], [370, 340, 520], [376, 300, 560], [384, 262, 598], [394, 230, 630],
  [406, 205, 655], [420, 186, 674], [436, 174, 686], [452, 166, 690],
  [480, 156, 698], [510, 149, 705], [540, 146, 711], [570, 143, 715], [600, 142, 717],
  [630, 142, 717], [660, 144, 714], [690, 145, 710], [720, 146, 707], [750, 147, 706],
  [780, 144, 712], [810, 137, 719], [840, 125, 727], [870, 114, 735], [900, 102, 741],
  [930, 91, 746], [960, 80, 751], [990, 71, 755], [1020, 62, 759], [1050, 53, 762],
  [1080, 45, 764], [1110, 38, 766], [1140, 32, 766], [1170, 27, 766], [1200, 24, 767],
];

/** Squareness of the cross-sections (2 = ellipse, higher = boxier). */
const SQUARE = 2.6;

function outlineAt(y: number) {
  let i = OUTLINE.findIndex((r) => r[0] >= y);
  if (i <= 0) i = 1;
  if (i === -1) i = OUTLINE.length - 1;
  const [y0, l0, r0] = OUTLINE[i - 1];
  const [y1, l1, r1] = OUTLINE[i];
  const f = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
  const l = l0 + (l1 - l0) * f;
  const r = r0 + (r1 - r0) * f;
  return { centre: toX((l + r) / 2), half: (r - l) / 2 / PX };
}

/** Front-to-back half depth: round head, deeper chest. */
function depthAt(y: number) {
  const { half } = outlineAt(y);
  const head = y < 780 ? 0.82 : 0.82 + ((y - 780) / 420) * 0.12;
  // The crown domes back over the top of the head.
  const crown = y < 452 ? Math.sqrt(Math.max(0.04, 1 - Math.pow((452 - y) / 86, 2))) : 1;
  return half * head * crown;
}

const superPow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

/** A point on the front of the body under image pixel (x, y), lifted slightly off the surface. */
function onFace(x: number, y: number, lift = 0.012): V3 {
  const { centre, half } = outlineAt(y);
  const X = toX(x);
  const u = Math.min(0.999, Math.abs((X - centre) / half));
  const z = depthAt(y) * Math.pow(1 - Math.pow(u, SQUARE), 1 / SQUARE);
  return [X, toY(y), z + lift];
}

export function cat() {
  const lb = new LineBuilder();

  // Body: stacked squarish cross-sections following the image outline, plus meridians.
  const levels: number[] = [];
  for (const y of [366, 370, 376, 384, 394, 406, 420, 436]) levels.push(y);
  for (let y = 460; y <= 1200; y += 40) levels.push(y);
  if (levels[levels.length - 1] !== 1200) levels.push(1200);
  const meridians = 20;
  const ring = (y: number) => {
    const { centre, half } = outlineAt(y);
    const d = depthAt(y);
    const pts: V3[] = [];
    for (let k = 0; k < meridians * 2; k++) {
      const t = (k / (meridians * 2)) * Math.PI * 2;
      pts.push([centre + half * superPow(Math.cos(t), 2 / SQUARE), toY(y), d * superPow(Math.sin(t), 2 / SQUARE)]);
    }
    return pts;
  };
  const rings = levels.map(ring);
  rings.forEach((r, i) => lb.polyline(r, true, scale(FUR, i === 0 || i === rings.length - 1 ? 0.8 : 0.5)));
  for (let k = 0; k < meridians * 2; k += 2) lb.polyline(rings.map((r) => r[k]), false, scale(FUR, 0.45));


  // Ears: wedges traced from the image, set on top of the head.
  const ears: [number, number][][] = [
    [[150, 450], [147, 330], [150, 285], [165, 258], [200, 270], [243, 300], [280, 330], [311, 360], [335, 374]],
    [[520, 374], [535, 360], [562, 330], [588, 300], [621, 270], [662, 255], [690, 285], [697, 330], [690, 450]],
  ];
  ears.forEach((outline, e) => {
    const side = e === 0 ? -1 : 1;
    const front = outline.map(([x, y]) => {
      const p = onFace(x, Math.max(y, 400), 0);
      // Ears rise from the crown, leaning slightly back toward their tips.
      const lean = (400 - Math.min(y, 400)) / PX;
      return [toX(x), toY(y), Math.max(0.06, p[2] * 0.7) - lean * 0.3] as V3;
    });
    const back = front.map(([x, y, z]) => [x, y, z - 0.14] as V3);
    // Nested contours shrink toward the ear's centre so it reads as a solid shape.
    const cx = front.reduce((a, p) => a + p[0], 0) / front.length;
    const cy = front.reduce((a, p) => a + p[1], 0) / front.length;
    for (const k of [0.8, 0.6, 0.4]) {
      lb.polyline(front.map(([x, y, z]) => [cx + (x - cx) * k, cy + (y - cy) * k, z + 0.01] as V3), false, scale(FUR, 0.35));
    }
    lb.polyline(front, false, FUR);
    lb.polyline(back, false, scale(FUR, 0.6));
    front.forEach((p, i) => i % 2 === 0 && lb.line(p, back[i], scale(FUR, 0.5)));
    // Inner ear: a smaller wedge toward the head, with gold hairs.
    const tip = front[e === 0 ? 3 : 5];
    const baseA = front[e === 0 ? 0 : front.length - 1];
    const baseB = front[e === 0 ? front.length - 1 : 0];
    const inner = (f: number): V3 => [
      tip[0] + (baseA[0] + (baseB[0] - baseA[0]) * f - tip[0]) * 0.8,
      tip[1] + (baseA[1] + (baseB[1] - baseA[1]) * f - tip[1]) * 0.8,
      tip[2] + 0.015,
    ];
    lb.polyline([inner(0.15), [tip[0] - side * 0.02, tip[1] - 0.06, tip[2] + 0.015], inner(0.85)], false, scale(FUR, 0.7));
    for (const f of [0.35, 0.5, 0.65]) {
      const start = inner(f);
      lb.line([tip[0] + (start[0] - tip[0]) * 0.3, tip[1] + (start[1] - tip[1]) * 0.3, tip[2] + 0.02], start, GOLD);
    }
  });

  // Eyes: gold irises filled with rings, darker amber crescent on the right, black pupils left open.
  const faceEllipse = (cx: number, cy: number, rx: number, ry: number, shade: Shade, from = 0, to = Math.PI * 2, steps = 36) => {
    const pts: V3[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      pts.push(onFace(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.02));
    }
    lb.polyline(pts, false, shade);
  };
  for (const [cx, cy, hx, hy] of [[301, 506, 306, 488], [543, 506, 528, 494]]) {
    faceEllipse(cx, cy, 61, 56, WHITE_LINE); // dark outline in the image, drawn light here
    for (let i = 0; i < 6; i++) {
      const f = i / 6;
      faceEllipse(cx, cy + 2, 57 - f * 30, 52 - f * 11, GOLD);
    }
    // Amber crescent on the right-hand side of each iris.
    for (const r of [0, 5, 10]) faceEllipse(cx + 6, cy + 2, 50 - r, 50 - r, AMBER_DARK, -1.1, 1.1, 14);
    // Pupil outline and highlight.
    faceEllipse(cx - 1, cy + 2, 24, 41, WHITE_LINE);
    faceEllipse(hx, hy, 5, 5, WHITE_LINE, 0, Math.PI * 2, 10);
  }

  // Nose: rounded inverted triangle; mouth: a line down then two curves out.
  const nose: [number, number][] = [[384, 546], [395, 536], [420, 532], [446, 536], [458, 546], [446, 562], [428, 576], [420, 580], [412, 576], [394, 562]];
  lb.polyline(nose.map(([x, y]) => onFace(x, y, 0.03)), true, WHITE_LINE);
  lb.polyline([[420, 580], [421, 596], [421, 610]].map(([x, y]) => onFace(x, y, 0.025)), false, WHITE_LINE);
  lb.polyline([[421, 610], [410, 626], [396, 636], [385, 640]].map(([x, y]) => onFace(x, y, 0.025)), false, WHITE_LINE);
  lb.polyline([[421, 610], [432, 626], [450, 636], [468, 638]].map(([x, y]) => onFace(x, y, 0.025)), false, WHITE_LINE);

  // Whiskers: gold, fanning from the cheeks out past the face.
  const whiskers: [number, number, number, number][] = [
    [345, 598, 142, 588], [345, 604, 146, 628], [348, 610, 158, 668], [352, 616, 150, 728],
    [512, 598, 716, 560], [515, 604, 716, 598], [512, 610, 712, 646], [515, 616, 700, 704],
  ];
  for (const [x0, y0, x1, y1] of whiskers) {
    const a = onFace(x0, y0, 0.02);
    const b = onFace(x1, y1, 0);
    lb.line(a, [b[0], b[1], b[2] + 0.14], GOLD);
  }

  // Soft fold where the cheeks meet the chest.
  lb.polyline([[178, 752], [230, 772], [290, 790], [320, 798]].map(([x, y]) => onFace(x, y)), false, scale(FUR, 0.8));
  lb.polyline([[640, 770], [675, 760], [706, 748]].map(([x, y]) => onFace(x, y)), false, scale(FUR, 0.8));

  return lb.build();
}
