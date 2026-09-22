import { LineBuilder, type Shade, type V3 } from './lines';

/*
 * Cars are lofted from cross-sections along their length (x: rear 0 → front, y: up,
 * z: across). Glass, lights and grilles are drawn as outlines on the body surface,
 * addressed by (x, k): position along the car and position around the section.
 *
 * Section points, one side, bottom centre → top centre:
 *   k0 bottom centre   k1 rocker        k2 widest point   k3 shoulder
 *   k4 fender crest / glass base        k5 roof edge (hood edge in front of the cabin)
 *   k6 roof mid        k7 roof centre
 */

interface Station {
  x: number;
  /** Half width at the widest point. */
  hw: number;
  bottom: number;
  /** Shoulder height. */
  belt: number;
  /** Height of the fender crest / glass base above the shoulder. */
  crest?: number;
  /** Height at the roof edge; in front of the cabin this is the hood edge. */
  roof: number;
  roofHw: number;
  /** Extra height at the centreline. */
  crown?: number;
}

interface Wheel {
  x: number;
  r: number;
  spokes: number;
  /** Deep-dish rims (Fuchs) vs. flat multi-spoke. */
  dish?: boolean;
}

type Side = 1 | -1;

const GLASS: V3 = [0.55, 0.72, 0.88];
const HEADLAMP: V3 = [1, 1, 0.94];
const AMBER: V3 = [1, 0.62, 0.1];
const TAIL_RED: V3 = [1, 0.22, 0.18];
const TRIM: V3 = [0.45, 0.5, 0.56];

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

class CarBody {
  readonly lb = new LineBuilder();
  private cols: Record<keyof Station, number[]>;
  readonly length: number;

  constructor(stations: Station[], private wheels: Wheel[], paint: V3 = [1, 1, 1]) {
    this.lb.tint = paint;
    const col = (k: keyof Station) => stations.map((s) => s[k] ?? 0);
    this.cols = {
      x: col('x'), hw: col('hw'), bottom: col('bottom'), belt: col('belt'), crest: col('crest'),
      roof: col('roof'), roofHw: col('roofHw'), crown: col('crown'),
    };
    this.length = stations[stations.length - 1].x;
  }

  /** Interpolated station at any x. */
  station(x: number): Station {
    const xs = this.cols.x;
    let i = xs.findIndex((v) => v > x) - 1;
    if (i < 0) i = x <= xs[0] ? 0 : xs.length - 2;
    const f = Math.min(1, Math.max(0, (x - xs[i]) / (xs[i + 1] - xs[i])));
    const t = i + f;
    const v = (k: keyof Station) => catmull(this.cols[k], t);
    return { x, hw: v('hw'), bottom: v('bottom'), belt: v('belt'), crest: v('crest'), roof: v('roof'), roofHw: v('roofHw'), crown: v('crown') };
  }

  /** The eight (z, y) section points for one side. */
  half(s: Station): [number, number][] {
    const crest = s.crest ?? 0;
    const crown = s.crown ?? 0;
    return [
      [0, s.bottom],
      [s.hw * 0.9, s.bottom],
      [s.hw, s.bottom + (s.belt - s.bottom) * 0.45],
      [s.hw * 0.985, s.belt],
      [s.roofHw + (s.hw - s.roofHw) * 0.6, s.belt + crest],
      [s.roofHw, s.roof],
      [s.roofHw * 0.5, s.roof + crown * 0.8],
      [0, s.roof + crown],
    ];
  }

  /** A point on the body surface; k may be fractional. `lift` pushes it outward slightly. */
  surf(x: number, k: number, side: Side = 1, lift = 0.004): V3 {
    const h = this.half(this.station(x));
    const i = Math.min(6, Math.max(0, Math.floor(k)));
    const f = k - i;
    const z = h[i][0] + (h[i + 1][0] - h[i][0]) * f;
    const y = h[i][1] + (h[i + 1][1] - h[i][1]) * f;
    const cz = 0;
    const cy = (h[0][1] + h[7][1]) / 2;
    const len = Math.hypot(z - cz, y - cy) || 1;
    return [x, y + ((y - cy) / len) * lift, side * (z + (z / len) * lift)];
  }

  /** Outline drawn on the surface through (x, k, side) control points. */
  path(points: [number, number, Side?][], closed = false, brightness: Shade = 1, steps = 6) {
    const pts: V3[] = [];
    const n = closed ? points.length : points.length - 1;
    for (let i = 0; i < n; i++) {
      const [x0, k0, s0 = 1] = points[i];
      const [x1, k1, s1 = 1] = points[(i + 1) % points.length];
      for (let j = 0; j < steps; j++) {
        const f = j / steps;
        // Crossing the centreline: walk to k7 on one side, then back down the other.
        if (s0 !== s1) {
          const kk = f < 0.5 ? k0 + (7 - k0) * f * 2 : 7 - (7 - k1) * (f - 0.5) * 2;
          pts.push(this.surf(x0 + (x1 - x0) * f, kk, f < 0.5 ? s0 : s1));
        } else {
          pts.push(this.surf(x0 + (x1 - x0) * f, k0 + (k1 - k0) * f, s0));
        }
      }
    }
    if (!closed) {
      const [x, k, s = 1] = points[points.length - 1];
      pts.push(this.surf(x, k, s));
    }
    this.lb.polyline(pts, closed, brightness);
  }

  /** Same outline on both sides of the car. */
  mirrored(points: [number, number][], closed = false, brightness: Shade = 1) {
    this.path(points.map(([x, k]) => [x, k, 1]), closed, brightness);
    this.path(points.map(([x, k]) => [x, k, -1]), closed, brightness);
  }

  private inArch(p: V3) {
    return this.wheels.some((w) => Math.hypot(p[0] - w.x, p[1] - w.r) < w.r + 0.06 && Math.abs(p[2]) > 0.3);
  }

  /** Cross-sections and the eight feature lines, with wheel arches cut out. */
  loft(step = 0.09) {
    const rings: V3[][] = [];
    const n = Math.ceil(this.length / step);
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * this.length;
      const h = this.half(this.station(x));
      rings.push([
        ...h.map(([z, y]) => [x, y, z] as V3),
        ...h.slice(0, -1).reverse().map(([z, y]) => [x, y, -z] as V3),
      ]);
    }
    const seg = (a: V3, b: V3, brightness: number) => {
      if (this.inArch(a) && this.inArch(b)) return;
      this.lb.line(a, b, brightness);
    };
    rings.forEach((ring, i) => {
      if (i % 2 === 0 || i === rings.length - 1) {
        for (let j = 0; j < ring.length - 1; j++) seg(ring[j], ring[j + 1], 0.55);
      }
      if (i < rings.length - 1) {
        // Shoulder and crest lines are the car's character lines: draw them brightest.
        for (let j = 0; j < ring.length; j++) {
          const k = j <= 7 ? j : 14 - j;
          seg(ring[j], rings[i + 1][j], k === 3 || k === 4 ? 1 : 0.7);
        }
      }
    });
    for (const ring of [rings[0], rings[rings.length - 1]]) {
      for (let j = 1; j < 7; j++) this.lb.line(ring[j], ring[ring.length - 1 - j], 0.4);
    }
  }

  /** Tyres, rims and arch lips. */
  drawWheels() {
    const paint = this.lb.tint;
    for (const w of this.wheels) {
      const hw = this.station(w.x).hw;
      for (const side of [-1, 1] as Side[]) {
        const zOut = side * (hw - 0.04);
        const zIn = side * (hw - 0.3);
        const zRim = side * (hw - (w.dish ? 0.1 : 0.06));
        // Tyres and rims in neutral grey; the arch lip below uses the paint colour.
        this.lb.tint = [0.72, 0.74, 0.78];
        const c = (r: number, a: number, z: number): V3 => [w.x + Math.cos(a) * r, w.r + Math.sin(a) * r, z];
        this.lb.ellipse([w.x, w.r, zOut], w.r, w.r, 'xy', 32);
        this.lb.ellipse([w.x, w.r, zIn], w.r, w.r, 'xy', 32, 0.5);
        this.lb.ellipse([w.x, w.r, zOut], w.r * 0.7, w.r * 0.7, 'xy', 28, 0.9);
        this.lb.ellipse([w.x, w.r, zRim], w.r * 0.66, w.r * 0.66, 'xy', 28, 0.8);
        this.lb.ellipse([w.x, w.r, zRim], w.r * 0.12, w.r * 0.12, 'xy', 10, 0.9);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          this.lb.line(c(w.r, a, zOut), c(w.r, a, zIn), 0.35);
        }
        for (let i = 0; i < w.spokes; i++) {
          const a = (i / w.spokes) * Math.PI * 2;
          if (w.dish) {
            // Fuchs petals: broad, rounded spokes.
            const b = a + 0.5;
            this.lb.polyline([c(w.r * 0.14, a, zRim), c(w.r * 0.58, a - 0.05, zRim), c(w.r * 0.62, (a + b) / 2, zRim), c(w.r * 0.58, b + 0.05, zRim), c(w.r * 0.14, b, zRim)], false, 0.9);
          } else {
            // Slim twin spokes.
            this.lb.line(c(w.r * 0.14, a, zRim), c(w.r * 0.66, a + 0.08, zRim), 0.9);
            this.lb.line(c(w.r * 0.14, a + 0.12, zRim), c(w.r * 0.66, a + 0.2, zRim), 0.9);
          }
        }
        this.lb.tint = paint;
        const arch: V3[] = [];
        for (let i = 0; i <= 20; i++) {
          const a = (i / 20) * Math.PI;
          arch.push([w.x + Math.cos(a) * (w.r + 0.06), w.r + Math.sin(a) * (w.r + 0.06), side * hw]);
        }
        this.lb.polyline(arch);
      }
    }
  }

  /** A ring standing on the body, facing along +x (headlights) or -x (tail lamps). */
  lamp(center: V3, r: number, brightness: Shade = 1, tilt = 0) {
    const pts: V3[] = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      pts.push([center[0] + Math.sin(a) * r * tilt, center[1] + Math.sin(a) * r, center[2] + Math.cos(a) * r]);
    }
    this.lb.polyline(pts, true, brightness);
  }

  build() {
    return this.lb.build();
  }
}

/* ------------------------------------------------------------------ */
/* Porsche 911 Turbo (930): round lamps in tall front wings, flared    */
/* rear arches, fastback into a whale-tail spoiler, full-width lamps.  */
/* ------------------------------------------------------------------ */

export function porsche930() {
  const car = new CarBody(
    [
      { x: 0.0, hw: 0.76, bottom: 0.3, belt: 0.6, roof: 0.72, roofHw: 0.6, crown: 0.02 },
      { x: 0.2, hw: 0.86, bottom: 0.24, belt: 0.72, crest: 0.05, roof: 0.86, roofHw: 0.58, crown: 0.03 },
      { x: 0.6, hw: 0.9, bottom: 0.22, belt: 0.78, crest: 0.08, roof: 0.98, roofHw: 0.52, crown: 0.04 },
      { x: 1.05, hw: 0.9, bottom: 0.22, belt: 0.8, crest: 0.09, roof: 1.12, roofHw: 0.5, crown: 0.04 },
      { x: 1.5, hw: 0.86, bottom: 0.22, belt: 0.83, crest: 0.05, roof: 1.25, roofHw: 0.54, crown: 0.03 },
      { x: 2.0, hw: 0.83, bottom: 0.22, belt: 0.84, crest: 0.04, roof: 1.3, roofHw: 0.56, crown: 0.03 },
      { x: 2.4, hw: 0.83, bottom: 0.22, belt: 0.84, crest: 0.04, roof: 1.28, roofHw: 0.57, crown: 0.03 },
      { x: 2.8, hw: 0.83, bottom: 0.22, belt: 0.82, crest: 0.03, roof: 0.86, roofHw: 0.58, crown: 0.04 },
      // Front: wings stand proud of a low bonnet.
      { x: 3.1, hw: 0.84, bottom: 0.22, belt: 0.74, crest: 0.08, roof: 0.74, roofHw: 0.4, crown: 0.03 },
      { x: 3.6, hw: 0.84, bottom: 0.22, belt: 0.72, crest: 0.09, roof: 0.68, roofHw: 0.4, crown: 0.02 },
      { x: 4.0, hw: 0.8, bottom: 0.24, belt: 0.66, crest: 0.08, roof: 0.6, roofHw: 0.38, crown: 0.02 },
      { x: 4.29, hw: 0.7, bottom: 0.26, belt: 0.48, crest: 0.02, roof: 0.47, roofHw: 0.4 },
    ],
    [
      { x: 1.02, r: 0.315, spokes: 5, dish: true },
      { x: 3.29, r: 0.305, spokes: 5, dish: true },
    ],
    // The photographed cars are black; silver keeps the lines visible on a dark page.
    [0.82, 0.84, 0.9],
  );
  car.loft();
  car.drawWheels();

  // Greenhouse: side window with the classic quarter light, windscreen and rear glass.
  car.mirrored([[2.76, 4.15], [2.42, 4.88], [1.6, 4.9], [1.28, 4.35], [1.4, 4.12]], true, GLASS);
  car.mirrored([[1.86, 4.12], [1.86, 4.9]], false, GLASS);
  car.mirrored([[2.95, 4.6], [2.7, 4.9], [1.5, 4.95], [1.05, 4.5]], false, 0.45); // rain gutter
  car.path([[2.78, 4.3, 1], [2.78, 4.3, -1], [2.42, 4.95, -1], [2.42, 4.95, 1]], true, GLASS);
  car.path([[1.45, 5.1, 1], [1.45, 5.1, -1], [0.82, 5.25, -1], [0.82, 5.25, 1]], true, GLASS);

  // Doors, front boot lid and engine lid.
  car.mirrored([[2.82, 1.1], [2.82, 3.9]], false, 0.6);
  car.mirrored([[1.78, 1.1], [1.72, 3.9]], false, 0.6);
  car.path([[4.08, 4.95, 1], [4.08, 4.95, -1], [3.02, 5.05, -1], [3.02, 5.05, 1]], true, 0.6);

  // Round headlamps set into the tops of the wings, plus indicators in the valance.
  for (const side of [-1, 1] as Side[]) {
    const p = car.surf(4.1, 3.6, side, 0.02);
    const lampZ = side * 0.58;
    car.lamp([p[0] + 0.02, 0.6, lampZ], 0.095, HEADLAMP, 0.35);
    car.lamp([p[0] + 0.03, 0.6, lampZ], 0.06, HEADLAMP, 0.35);
    // Chrome ring where the lamp bowl meets the wing.
    car.lamp([p[0] - 0.02, 0.605, lampZ], 0.112, 0.6, 0.35);
    car.lb.polyline(
      [[4.29, 0.4, side * 0.4], [4.29, 0.4, side * 0.6], [4.26, 0.45, side * 0.6], [4.26, 0.45, side * 0.4]],
      true,
      AMBER,
    );
    // Door mirror.
    const m = car.surf(2.66, 4.2, side, 0.01);
    car.lb.polyline([m, [m[0] - 0.05, m[1] + 0.07, side * 1.0], [m[0] - 0.17, m[1] + 0.06, side * 1.0], [m[0] - 0.12, m[1] - 0.01, m[2]]], true, 0.9);
  }
  // Side script stripe along the doors, like the "PORSCHE" lettering in the photo.
  const SCRIPT: V3 = [0.3, 0.78, 0.68];
  car.mirrored([[2.62, 1.95], [1.92, 1.95]], false, SCRIPT);
  car.mirrored([[2.62, 2.15], [1.92, 2.15]], false, SCRIPT);
  for (let i = 0; i <= 7; i++) {
    const x = 2.58 - i * 0.087;
    car.mirrored([[x, 1.95], [x - 0.02, 2.15]], false, SCRIPT);
  }

  // Front bumper with the bellows seam.
  car.lb.polyline([[4.33, 0.26, -0.7], [4.33, 0.26, 0.7], [4.33, 0.38, 0.7], [4.33, 0.38, -0.7]], true, 0.7);

  // Whale tail: a flat tray sitting on the engine lid, closed by side plates,
  // with a raised rubber lip along its trailing edge.
  const front: [number, number] = [0.66, 0.99];
  const rear: [number, number] = [0.0, 1.01];
  const lip: [number, number] = [-0.07, 1.08];
  car.lb.polyline([[front[0], front[1], -0.7], [front[0], front[1], 0.7], [rear[0], rear[1], 0.84], [rear[0], rear[1], -0.84]], true);
  car.lb.polyline([[lip[0], lip[1], -0.86], [lip[0], lip[1], 0.86]]);
  for (const side of [-1, 1]) {
    car.lb.line([lip[0], lip[1], side * 0.86], [rear[0], rear[1], side * 0.84]);
    // Side plate: from the tray edge down onto the body.
    car.lb.polyline([[front[0], front[1], side * 0.7], [0.4, 0.9, side * 0.8], [0.04, 0.78, side * 0.84], [rear[0], rear[1], side * 0.84]], false, 0.9);
  }
  // Intercooler grille slats in the tray.
  for (let i = 1; i < 9; i++) {
    const z = -0.62 + (i / 9) * 1.24;
    car.lb.line([0.56, 0.995, z], [0.1, 1.008, z], 0.55);
  }

  // Full-width tail-lamp bar with the reflector band, rear bumper and exhausts.
  car.lb.polyline([[0.0, 0.58, -0.74], [0.0, 0.58, 0.74], [0.0, 0.7, 0.74], [0.0, 0.7, -0.74]], true, TAIL_RED);
  car.lb.line([0.0, 0.64, -0.74], [0.0, 0.64, 0.74], [0.7, 0.14, 0.12]);
  for (const side of [-1, 1]) car.lb.line([0.0, 0.58, side * 0.5], [0.0, 0.7, side * 0.5], AMBER);
  car.lb.polyline([[-0.04, 0.28, -0.76], [-0.04, 0.28, 0.76], [-0.04, 0.42, 0.76], [-0.04, 0.42, -0.76]], true, 0.7);
  for (const z of [-0.52, -0.4]) car.lb.ellipse([-0.06, 0.24, z], 0.045, 0.045, 'yz', 10, TRIM);

  return car.build();
}

/* ------------------------------------------------------------------ */
/* Lexus LFA: pointed V nose, wide lower mesh intake, triangular      */
/* corner vents, swept lamps, two bonnet vents; at the back, big      */
/* triangular mesh panels under blade tail-lamps and a triple exhaust. */
/* ------------------------------------------------------------------ */

export function lexusLFA() {
  const car = new CarBody(
    [
      { x: 0.0, hw: 0.86, bottom: 0.32, belt: 0.82, crest: 0.04, roof: 0.92, roofHw: 0.68, crown: 0.02 },
      { x: 0.2, hw: 0.94, bottom: 0.26, belt: 0.85, crest: 0.06, roof: 0.97, roofHw: 0.62, crown: 0.03 },
      { x: 0.7, hw: 0.96, bottom: 0.24, belt: 0.84, crest: 0.06, roof: 1.01, roofHw: 0.52, crown: 0.04 },
      { x: 1.2, hw: 0.95, bottom: 0.24, belt: 0.82, crest: 0.05, roof: 1.15, roofHw: 0.52, crown: 0.04 },
      { x: 1.75, hw: 0.9, bottom: 0.24, belt: 0.82, crest: 0.04, roof: 1.22, roofHw: 0.55, crown: 0.03 },
      { x: 2.2, hw: 0.9, bottom: 0.24, belt: 0.8, crest: 0.04, roof: 1.18, roofHw: 0.58, crown: 0.03 },
      { x: 2.75, hw: 0.91, bottom: 0.24, belt: 0.77, crest: 0.04, roof: 0.86, roofHw: 0.66, crown: 0.04 },
      // Long bonnet between high front wings, narrowing to a pointed nose.
      { x: 3.3, hw: 0.94, bottom: 0.24, belt: 0.73, crest: 0.07, roof: 0.78, roofHw: 0.54, crown: 0.05 },
      { x: 3.9, hw: 0.93, bottom: 0.24, belt: 0.68, crest: 0.07, roof: 0.69, roofHw: 0.48, crown: 0.05 },
      { x: 4.3, hw: 0.86, bottom: 0.22, belt: 0.56, crest: 0.04, roof: 0.56, roofHw: 0.36, crown: 0.05 },
      { x: 4.5, hw: 0.66, bottom: 0.22, belt: 0.42, crest: 0.01, roof: 0.44, roofHw: 0.22, crown: 0.03 },
    ],
    [
      { x: 0.93, r: 0.34, spokes: 10 },
      { x: 3.54, r: 0.335, spokes: 10 },
    ],
    // Pearl white, as in both photos.
    [0.93, 0.94, 0.98],
  );
  car.loft();
  car.drawWheels();

  const MESH: V3 = [0.42, 0.45, 0.52];

  // Greenhouse.
  car.mirrored([[2.72, 4.15], [2.22, 4.9], [1.7, 4.95], [1.12, 4.45], [1.34, 4.12]], true, GLASS);
  car.path([[2.76, 4.3, 1], [2.76, 4.3, -1], [2.22, 4.95, -1], [2.22, 4.95, 1]], true, GLASS);
  car.path([[1.6, 5.1, 1], [1.6, 5.1, -1], [0.78, 5.3, -1], [0.78, 5.3, 1]], true, GLASS);
  // Flush rear wing line across the deck and the shark-fin antenna.
  car.path([[0.14, 5.4, 1], [0.14, 5.4, -1]], false, MESH);
  const fin = car.surf(1.5, 7, 1, 0);
  car.lb.polyline([[fin[0] - 0.12, fin[1], 0], [fin[0] - 0.02, fin[1] + 0.07, 0], [fin[0] + 0.04, fin[1], 0]], false, 0.9);

  for (const side of [-1, 1] as Side[]) {
    // Two small mesh vents on the bonnet.
    car.path([[3.5, 5.5, side], [3.5, 6.1, side], [3.72, 6.1, side], [3.72, 5.5, side]], true, MESH);
    // Swept headlamp with a sharp inner point, and its projector.
    car.path([[4.44, 3.1, side], [4.26, 3.9, side], [4.08, 4.6, side], [4.22, 4.35, side], [4.4, 3.55, side]], true, HEADLAMP);
    const pr = car.surf(4.3, 3.6, side, 0.01);
    car.lamp(pr, 0.04, HEADLAMP, 0.6);
    // Triangular corner intakes with mesh.
    const tri: V3[] = [[4.47, 0.5, side * 0.5], [4.4, 0.52, side * 0.78], [4.42, 0.28, side * 0.72]];
    car.lb.polyline(tri, true, MESH);
    for (let i = 1; i < 4; i++) car.lb.line([4.46, 0.5 - i * 0.05, side * (0.52 + i * 0.03)], [4.42, 0.5 - i * 0.05, side * 0.74], MESH);
    // Side scoop ahead of the rear wheel, fed by the crease along the door.
    car.path([[1.62, 2.2, side], [1.3, 3.1, side], [1.48, 3.55, side], [1.8, 2.6, side]], true, MESH);
    car.path([[2.9, 2.6, side], [2.2, 2.9, side], [1.8, 3.05, side]], false, 0.8);
    // Door line and mirror.
    car.path([[2.8, 1.2, side], [2.78, 3.9, side]], false, 0.6);
    const m = car.surf(2.6, 4.2, side, 0.01);
    car.lb.polyline([m, [m[0] - 0.04, m[1] + 0.07, side * 1.06], [m[0] - 0.17, m[1] + 0.07, side * 1.06], [m[0] - 0.13, m[1] - 0.01, m[2]]], true, 0.9);
    // Side markers.
    car.path([[4.2, 2.6, side], [4.12, 2.6, side]], false, AMBER);
  }

  // Wide lower intake with mesh, splitter, and the Lexus badge on the nose.
  const gx = 4.52;
  car.lb.polyline([[gx, 0.24, -0.42], [gx, 0.24, 0.42], [gx - 0.02, 0.37, 0.36], [gx - 0.02, 0.37, -0.36]], true, MESH);
  for (let i = -8; i <= 8; i++) car.lb.line([gx, 0.24, i * 0.05], [gx - 0.02, 0.37, i * 0.043], scale3(MESH, 0.8));
  car.lb.line([gx - 0.01, 0.305, -0.39], [gx - 0.01, 0.305, 0.39], scale3(MESH, 0.8));
  car.lb.polyline([[4.56, 0.2, -0.7], [4.56, 0.2, 0.7]], false, MESH);
  car.lb.ellipse([4.5, 0.44, 0], 0.035, 0.045, 'yz', 14, 0.9);
  // The bonnet's V shut line meeting at the nose.
  car.path([[3.95, 4.9, 1], [4.46, 6.6, 1]], false, 0.6);
  car.path([[3.95, 4.9, -1], [4.46, 6.6, -1]], false, 0.6);

  // Rear: triangular mesh panels under blade tail-lamps.
  for (const side of [-1, 1]) {
    const tri: V3[] = [[-0.01, 0.8, side * 0.44], [-0.01, 0.8, side * 0.9], [-0.01, 0.44, side * 0.86]];
    car.lb.polyline(tri, true, MESH);
    for (let i = 1; i < 6; i++) {
      const y = 0.8 - i * 0.06;
      const zIn = 0.44 + (0.86 - 0.44) * ((0.8 - y) / 0.36);
      car.lb.line([-0.01, y, side * zIn], [-0.01, y, side * 0.89], scale3(MESH, 0.8));
    }
    for (let i = 1; i < 5; i++) {
      const z = 0.44 + i * 0.1;
      car.lb.line([-0.01, 0.8, side * z], [-0.01, 0.8 - Math.min(0.36, (z - 0.44) * 0.86), side * z], scale3(MESH, 0.8));
    }
    // Tail-lamp blade: pointed at the inner end.
    car.lb.polyline([[0.0, 0.86, side * 0.4], [0.0, 0.84, side * 0.94], [0.0, 0.8, side * 0.94], [0.0, 0.81, side * 0.5]], true, TAIL_RED);
  }
  // Plate recess, badge, triple exhaust and diffuser.
  car.lb.polyline([[-0.01, 0.5, -0.24], [-0.01, 0.5, 0.24], [-0.01, 0.66, 0.24], [-0.01, 0.66, -0.24]], true, 0.6);
  car.lb.ellipse([-0.01, 0.74, 0], 0.03, 0.04, 'yz', 12, 0.9);
  for (const [z, y] of [[-0.07, 0.36], [0.07, 0.36], [0, 0.27]]) car.lb.ellipse([-0.04, y, z], 0.045, 0.045, 'yz', 14, TRIM);
  car.lb.polyline([[-0.02, 0.24, -0.7], [-0.02, 0.24, 0.7]], false, MESH);
  for (let i = -3; i <= 3; i++) if (i !== 0) car.lb.line([-0.02, 0.4, i * 0.16], [-0.02, 0.24, i * 0.16], MESH);

  return car.build();
}

function scale3(c: V3, k: number): V3 {
  return [c[0] * k, c[1] * k, c[2] * k];
}
