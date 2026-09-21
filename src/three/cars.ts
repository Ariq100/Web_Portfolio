import { LineBuilder, type V3 } from './lines';

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

  constructor(stations: Station[], private wheels: Wheel[]) {
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
  path(points: [number, number, Side?][], closed = false, brightness = 1, steps = 6) {
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
  mirrored(points: [number, number][], closed = false, brightness = 1) {
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
    for (const w of this.wheels) {
      const hw = this.station(w.x).hw;
      for (const side of [-1, 1] as Side[]) {
        const zOut = side * (hw - 0.04);
        const zIn = side * (hw - 0.3);
        const zRim = side * (hw - (w.dish ? 0.1 : 0.06));
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
  lamp(center: V3, r: number, brightness = 1, tilt = 0) {
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
  );
  car.loft();
  car.drawWheels();

  // Greenhouse: side window with the classic quarter light, windscreen and rear glass.
  car.mirrored([[2.76, 4.15], [2.42, 4.88], [1.6, 4.9], [1.28, 4.35], [1.4, 4.12]], true);
  car.mirrored([[1.86, 4.12], [1.86, 4.9]], false, 0.8);
  car.mirrored([[2.95, 4.6], [2.7, 4.9], [1.5, 4.95], [1.05, 4.5]], false, 0.45); // rain gutter
  car.path([[2.78, 4.3, 1], [2.78, 4.3, -1], [2.42, 4.95, -1], [2.42, 4.95, 1]], true);
  car.path([[1.45, 5.1, 1], [1.45, 5.1, -1], [0.82, 5.25, -1], [0.82, 5.25, 1]], true);

  // Doors, front boot lid and engine lid.
  car.mirrored([[2.82, 1.1], [2.82, 3.9]], false, 0.6);
  car.mirrored([[1.78, 1.1], [1.72, 3.9]], false, 0.6);
  car.path([[4.08, 4.95, 1], [4.08, 4.95, -1], [3.02, 5.05, -1], [3.02, 5.05, 1]], true, 0.6);

  // Round headlamps set into the tops of the wings, plus indicators in the valance.
  for (const side of [-1, 1] as Side[]) {
    const p = car.surf(4.02, 3.9, side, 0.02);
    car.lamp([p[0] + 0.03, p[1] + 0.01, p[2] * 0.93], 0.1, 1, 0.3);
    car.lamp([p[0] + 0.035, p[1] + 0.01, p[2] * 0.93], 0.065, 0.7, 0.3);
    car.lb.polyline(
      [[4.29, 0.4, side * 0.4], [4.29, 0.4, side * 0.6], [4.26, 0.45, side * 0.6], [4.26, 0.45, side * 0.4]],
      true,
      0.9,
    );
    // Door mirror.
    const m = car.surf(2.66, 4.2, side, 0.01);
    car.lb.polyline([m, [m[0] - 0.05, m[1] + 0.07, side * 1.0], [m[0] - 0.17, m[1] + 0.06, side * 1.0], [m[0] - 0.12, m[1] - 0.01, m[2]]], true, 0.9);
  }
  // Front bumper with the bellows seam.
  car.lb.polyline([[4.33, 0.26, -0.7], [4.33, 0.26, 0.7], [4.33, 0.38, 0.7], [4.33, 0.38, -0.7]], true, 0.7);

  // Whale tail: flat engine-lid wing with a raised rubber lip that overhangs the body.
  const y = 1.02;
  car.lb.polyline([[0.62, y - 0.05, -0.74], [0.62, y - 0.05, 0.74], [0.02, y, 0.84], [0.02, y, -0.84]], true);
  car.lb.polyline([[-0.06, y + 0.09, -0.86], [-0.06, y + 0.09, 0.86]]);
  for (const z of [-0.86, 0.86]) car.lb.line([-0.06, y + 0.09, z], [0.02, y, z * 0.98]);
  for (let i = 1; i < 9; i++) {
    const z = -0.62 + (i / 9) * 1.24;
    car.lb.line([0.14, y - 0.005, z], [0.52, y - 0.04, z], 0.55);
  }
  for (const z of [-0.52, 0.52]) car.lb.polyline([[0.35, y - 0.03, z], [0.3, 0.86, z * 1.05]], false, 0.6);

  // Full-width tail-lamp bar with the reflector band, rear bumper and exhausts.
  car.lb.polyline([[0.0, 0.58, -0.74], [0.0, 0.58, 0.74], [0.0, 0.7, 0.74], [0.0, 0.7, -0.74]], true);
  car.lb.line([0.0, 0.64, -0.74], [0.0, 0.64, 0.74], 0.6);
  car.lb.polyline([[-0.04, 0.28, -0.76], [-0.04, 0.28, 0.76], [-0.04, 0.42, 0.76], [-0.04, 0.42, -0.76]], true, 0.7);
  for (const z of [-0.52, -0.4]) car.lb.ellipse([-0.06, 0.24, z], 0.045, 0.045, 'yz', 10, 0.8);

  return car.build();
}

/* ------------------------------------------------------------------ */
/* Aston Martin Vantage: long bonnet with vents, wide mesh grille,     */
/* swept lamps, fastback into a ducktail, blade tail-lamp, diffuser.   */
/* ------------------------------------------------------------------ */

export function astonVantage() {
  const car = new CarBody(
    [
      { x: 0.0, hw: 0.9, bottom: 0.34, belt: 0.82, crest: 0.04, roof: 0.92, roofHw: 0.62, crown: 0.02 },
      { x: 0.22, hw: 0.97, bottom: 0.26, belt: 0.84, crest: 0.06, roof: 0.96, roofHw: 0.6, crown: 0.03 },
      { x: 0.7, hw: 0.99, bottom: 0.24, belt: 0.82, crest: 0.08, roof: 1.06, roofHw: 0.5, crown: 0.04 },
      { x: 1.25, hw: 0.97, bottom: 0.24, belt: 0.8, crest: 0.06, roof: 1.2, roofHw: 0.52, crown: 0.04 },
      { x: 1.75, hw: 0.93, bottom: 0.24, belt: 0.8, crest: 0.04, roof: 1.27, roofHw: 0.56, crown: 0.03 },
      { x: 2.2, hw: 0.92, bottom: 0.24, belt: 0.8, crest: 0.04, roof: 1.24, roofHw: 0.58, crown: 0.03 },
      { x: 2.8, hw: 0.93, bottom: 0.24, belt: 0.78, crest: 0.04, roof: 0.84, roofHw: 0.66, crown: 0.05 },
      // Long bonnet over bulging front wings.
      { x: 3.3, hw: 0.97, bottom: 0.24, belt: 0.74, crest: 0.06, roof: 0.8, roofHw: 0.56, crown: 0.06 },
      { x: 3.9, hw: 0.97, bottom: 0.24, belt: 0.7, crest: 0.06, roof: 0.72, roofHw: 0.54, crown: 0.05 },
      { x: 4.3, hw: 0.9, bottom: 0.22, belt: 0.6, crest: 0.04, roof: 0.6, roofHw: 0.5, crown: 0.03 },
      { x: 4.5, hw: 0.74, bottom: 0.2, belt: 0.46, crest: 0.01, roof: 0.48, roofHw: 0.46, crown: 0.01 },
    ],
    [
      { x: 0.86, r: 0.35, spokes: 5 },
      { x: 3.56, r: 0.35, spokes: 5 },
    ],
  );
  car.loft();
  car.drawWheels();

  // Greenhouse: single sweeping side window, windscreen, rear glass.
  car.mirrored([[2.78, 4.15], [2.3, 4.9], [1.65, 4.95], [1.05, 4.4], [1.2, 4.12]], true);
  car.path([[2.8, 4.3, 1], [2.8, 4.3, -1], [2.3, 4.95, -1], [2.3, 4.95, 1]], true);
  car.path([[1.55, 5.1, 1], [1.55, 5.1, -1], [0.55, 5.35, -1], [0.55, 5.35, 1]], true);

  // Bonnet vents and the side strakes behind the front wheels.
  for (const side of [-1, 1] as Side[]) {
    car.path([[3.2, 5.6, side], [3.55, 6.3, side]], false, 0.8);
    car.path([[3.15, 5.75, side], [3.5, 6.45, side]], false, 0.8);
    car.path([[3.12, 2.4, side], [2.95, 3.4, side], [3.02, 3.5, side], [3.18, 2.5, side]], true, 0.9);
    // Door line and mirror.
    car.path([[2.86, 1.2, side], [2.86, 3.9, side]], false, 0.6);
    const m = car.surf(2.64, 4.2, side, 0.01);
    car.lb.polyline([m, [m[0] - 0.04, m[1] + 0.08, side * 1.1], [m[0] - 0.18, m[1] + 0.07, side * 1.1], [m[0] - 0.13, m[1] - 0.01, m[2]]], true, 0.9);
    // Swept headlamps along the top of each wing.
    car.path([[4.38, 3.3, side], [4.2, 3.95, side], [3.98, 4.15, side], [4.1, 3.7, side], [4.3, 3.2, side]], true);
    car.path([[4.3, 3.45, side], [4.12, 3.85, side]], false, 0.7);
    // Rear haunch crease.
    car.path([[0.35, 3.2, side], [1.1, 3.3, side], [1.5, 3.9, side]], false, 0.7);
  }

  // Wide grille: lower-mouth trapezoid filled with a diamond mesh.
  const gx = 4.52;
  const gTop = 0.5;
  const gBot = 0.24;
  const topHw = 0.5;
  const botHw = 0.62;
  car.lb.polyline([[gx, gBot, -botHw], [gx, gBot, botHw], [gx - 0.03, gTop, topHw], [gx - 0.03, gTop, -topHw]], true);
  const hwAt = (y: number) => botHw + (topHw - botHw) * ((y - gBot) / (gTop - gBot));
  for (let i = -6; i <= 6; i++) {
    for (const dir of [1, -1]) {
      const z0 = (i / 6) * botHw;
      const z1 = z0 + dir * (gTop - gBot) * 1.4;
      if (Math.abs(z1) > hwAt(gTop) || Math.abs(z0) > botHw) continue;
      car.lb.line([gx, gBot, z0], [gx - 0.03, gTop, z1], 0.45);
    }
  }
  // Splitter lip under the grille.
  car.lb.polyline([[4.56, 0.2, -0.78], [4.56, 0.2, 0.78]], false, 0.9);

  // Blade tail-lamp across the ducktail, diffuser fins and quad exhausts.
  car.lb.polyline([[-0.02, 0.9, -0.84], [0.02, 0.88, 0], [-0.02, 0.9, 0.84]]);
  car.lb.polyline([[-0.03, 0.96, -0.72], [-0.03, 0.96, 0.72]], false, 0.8);
  car.lb.polyline([[-0.02, 0.36, -0.7], [-0.02, 0.36, 0.7]], false, 0.8);
  for (let i = -3; i <= 3; i++) car.lb.line([-0.02, 0.36, i * 0.12], [-0.02, 0.22, i * 0.12], 0.6);
  for (const z of [-0.5, -0.36, 0.36, 0.5]) car.lb.ellipse([-0.04, 0.29, z], 0.05, 0.05, 'yz', 12, 0.9);
  car.lb.polyline([[-0.01, 0.46, -0.26], [-0.01, 0.46, 0.26], [-0.01, 0.6, 0.26], [-0.01, 0.6, -0.26]], true, 0.5);

  return car.build();
}
