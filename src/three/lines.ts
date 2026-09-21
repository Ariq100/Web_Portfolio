import * as THREE from 'three';

export type V3 = [number, number, number];
/** Grey level (0..1) or an RGB colour, multiplied with the material colour. */
export type Shade = number | V3;

/** Accumulates line segments (pairs of points) and turns them into one BufferGeometry. */
export class LineBuilder {
  private positions: number[] = [];
  private colors: number[] = [];
  private matrix = new THREE.Matrix4();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  /** Subsequent lines are transformed by this matrix until reset. */
  setTransform(position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
    this.matrix.compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    );
    return this;
  }

  resetTransform() {
    this.matrix.identity();
    return this;
  }

  /** Colour applied to lines given as a plain grey level (e.g. a car's paint). */
  tint: V3 = [1, 1, 1];

  line(a: V3, b: V3, brightness: Shade = 1) {
    this.tmpA.set(...a).applyMatrix4(this.matrix);
    this.tmpB.set(...b).applyMatrix4(this.matrix);
    this.positions.push(this.tmpA.x, this.tmpA.y, this.tmpA.z, this.tmpB.x, this.tmpB.y, this.tmpB.z);
    const [r, g, b2] =
      typeof brightness === 'number'
        ? [this.tint[0] * brightness, this.tint[1] * brightness, this.tint[2] * brightness]
        : brightness;
    this.colors.push(r, g, b2, r, g, b2);
  }

  polyline(points: V3[], closed = false, brightness: Shade = 1) {
    for (let i = 0; i < points.length - 1; i++) this.line(points[i], points[i + 1], brightness);
    if (closed && points.length > 2) this.line(points[points.length - 1], points[0], brightness);
  }

  /** Ellipse in a local plane: `axisU`/`axisV` choose which world axes it spans. */
  ellipse(center: V3, ru: number, rv: number, plane: 'xy' | 'xz' | 'yz', segments = 24, brightness: Shade = 1) {
    const pts: V3[] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const u = Math.cos(a) * ru;
      const v = Math.sin(a) * rv;
      if (plane === 'xy') pts.push([center[0] + u, center[1] + v, center[2]]);
      else if (plane === 'xz') pts.push([center[0] + u, center[1], center[2] + v]);
      else pts.push([center[0], center[1] + v, center[2] + u]);
    }
    this.polyline(pts, true, brightness);
  }

  /** Rings + meridians of an ellipsoid. */
  ellipsoid(center: V3, r: V3, rings = 7, meridians = 12, brightness: Shade = 1) {
    const point = (lat: number, lon: number): V3 => [
      center[0] + Math.cos(lat) * Math.cos(lon) * r[0],
      center[1] + Math.sin(lat) * r[1],
      center[2] + Math.cos(lat) * Math.sin(lon) * r[2],
    ];
    for (let i = 1; i < rings; i++) {
      const lat = -Math.PI / 2 + (i / rings) * Math.PI;
      const pts: V3[] = [];
      for (let j = 0; j < meridians * 2; j++) pts.push(point(lat, (j / (meridians * 2)) * Math.PI * 2));
      this.polyline(pts, true, brightness);
    }
    for (let j = 0; j < meridians; j++) {
      const lon = (j / meridians) * Math.PI * 2;
      const pts: V3[] = [];
      for (let i = 0; i <= rings * 2; i++) pts.push(point(-Math.PI / 2 + (i / (rings * 2)) * Math.PI, lon));
      this.polyline(pts, false, brightness);
    }
  }

  /** Surface of revolution around Y from a (radius, y) profile. */
  lathe(profile: [number, number][], segments = 14, center: V3 = [0, 0, 0], zScale = 1, brightness: Shade = 1) {
    const ring = (r: number, y: number) => {
      const pts: V3[] = [];
      for (let j = 0; j < segments * 2; j++) {
        const a = (j / (segments * 2)) * Math.PI * 2;
        pts.push([center[0] + Math.cos(a) * r, center[1] + y, center[2] + Math.sin(a) * r * zScale]);
      }
      return pts;
    };
    profile.forEach(([r, y]) => r > 0.001 && this.polyline(ring(r, y), true, brightness));
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      this.polyline(
        profile.map(([r, y]) => [center[0] + Math.cos(a) * r, center[1] + y, center[2] + Math.sin(a) * r * zScale]),
        false,
        brightness,
      );
    }
  }

  /** Tube around a curve: cross-section rings plus a few longitudinal lines. */
  tube(curvePoints: V3[], radius: (t: number) => number, samples = 24, radial = 6, brightness: Shade = 1) {
    const curve = new THREE.CatmullRomCurve3(curvePoints.map((p) => new THREE.Vector3(...p)));
    const frames = curve.computeFrenetFrames(samples, false);
    const rings: V3[][] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = curve.getPointAt(t);
      const n = frames.normals[i];
      const b = frames.binormals[i];
      const r = radius(t);
      const ring: V3[] = [];
      for (let k = 0; k < radial; k++) {
        const a = (k / radial) * Math.PI * 2;
        ring.push([
          p.x + (Math.cos(a) * n.x + Math.sin(a) * b.x) * r,
          p.y + (Math.cos(a) * n.y + Math.sin(a) * b.y) * r,
          p.z + (Math.cos(a) * n.z + Math.sin(a) * b.z) * r,
        ]);
      }
      rings.push(ring);
      if (i % 2 === 0) this.polyline(ring, true, brightness);
    }
    for (let k = 0; k < radial; k++) this.polyline(rings.map((ring) => ring[k]), false, brightness);
  }

  build(normalize = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    if (normalize) normalizeGeometry(g);
    return g;
  }
}

/** Centers the geometry and scales it so its largest dimension is 1. */
export function normalizeGeometry(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = 1 / Math.max(size.x, size.y, size.z);
  g.translate(-center.x, -center.y, -center.z);
  g.scale(s, s, s);
  g.computeBoundingSphere();
  return g;
}
