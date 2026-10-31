import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Paints the terminal background onto a full-screen canvas, then rips shallow-edged holes
 * along the pointer path. The holes reveal the black page behind it and slowly heal.
 */

const BG = '#1e1e1e';
const LIFETIME = 1100; // ms until a tear fully heals
const OPEN_TIME = 22; // ms for a fresh tear to split open (short so the rip stays under the cursor)
const MIN_DIST = 5; // px between samples
const MAX_STEP = 9; // px; fast moves are filled in so the rip never skips
const BREAK_GAP = 140; // ms without movement starts a new tear
const MAX_WIDTH = 9; // px, keep the trailing slit close to the cursor's width
const EDGE_DETAIL = 0.2; // Keep 20% of the previous edge cuts and jaggedness.
const EDGE_STRIDE = Math.round(1 / EDGE_DETAIL);
// One outline drives both the visible arrow and the cut, avoiding OS cursor-size guesses.
const CURSOR_OUTLINE = 'M0 0L0 19L4.5 14.5L8 22L11.5 20.5L8 13L15 13Z';
const CURSOR_STROKE = 1.25;
const CURSOR_GAP = 1.5;
const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="27" viewBox="0 0 20 27"><path d="${CURSOR_OUTLINE}" transform="translate(2 2)" fill="#080808" stroke="white" stroke-width="${CURSOR_STROKE}" stroke-linejoin="round"/></svg>`;
const CURSOR_IMAGE = `url("data:image/svg+xml,${encodeURIComponent(CURSOR_SVG)}") 2 2`;

interface TearPoint {
  x: number;
  y: number;
  t: number;
  /** Per-point randomness so the jagged edge stays stable between frames. */
  jl: number;
  jr: number;
  ml: number;
  mr: number;
  fiber: number;
  speed: number;
}

type Tear = TearPoint[];

/**
 * The tear canvas, shared so the home photo can be torn with exactly the same holes:
 * its alpha is 0 where the screen is ripped. `version` bumps whenever it is repainted.
 */
export const tearSurface = { canvas: null as HTMLCanvasElement | null, version: 0 };

export function TearCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    tearSurface.canvas = canvas;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const paintBackground = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBackground();
      tearSurface.version++;
    };
    resize();
    window.addEventListener('resize', resize);
    if (reduced) return () => window.removeEventListener('resize', resize);

    const root = document.documentElement;
    root.style.setProperty('--tear-cursor', CURSOR_IMAGE);
    root.classList.add('has-tear-cursor');
    const cursorPath = new Path2D(CURSOR_OUTLINE);

    const tears: Tear[] = [];
    let cursor: { x: number; y: number; t: number } | null = null;
    let last: TearPoint | null = null;
    let lastStamp: number | null = null;
    let raf = 0;

    const addPoint = (x: number, y: number, t: number, speed: number) => {
      const point: TearPoint = {
        x,
        y,
        t,
        jl: 0.725 + (Math.random() - 0.5) * 0.55 * EDGE_DETAIL,
        jr: 0.725 + (Math.random() - 0.5) * 0.55 * EDGE_DETAIL,
        ml: Math.random(),
        mr: Math.random(),
        fiber: Math.random(),
        speed,
      };
      tears[tears.length - 1].push(point);
      last = point;
    };

    const onMove = (e: PointerEvent) => {
      // Coalesced events carry every position the pointer passed through since the last frame.
      const samples = e.getCoalescedEvents?.() ?? [];
      const events = samples.length ? samples : [e];
      const now = performance.now();

      for (const ev of events) {
        const x = ev.clientX;
        const y = ev.clientY;
        // Follow every pointer sample, including movement smaller than the trail spacing.
        cursor = { x, y, t: now };
        if (!last || now - last.t > BREAK_GAP || tears.length === 0) {
          tears.push([]);
          last = null;
        }
        if (!last) {
          addPoint(x, y, now, 0.3);
          continue;
        }
        const d = Math.hypot(x - last.x, y - last.y);
        if (d < MIN_DIST) continue;
        const dt = Math.max(1, ev.timeStamp - (lastStamp ?? ev.timeStamp - 16));
        const speed = Math.min(1, d / dt / 1.2);
        // Fill the gap with evenly spaced points so even a flick draws a continuous rip.
        const steps = Math.ceil(d / MAX_STEP);
        const fromX = last.x;
        const fromY = last.y;
        for (let k = 1; k <= steps; k++) addPoint(fromX + ((x - fromX) * k) / steps, fromY + ((y - fromY) * k) / steps, now, speed);
        lastStamp = ev.timeStamp;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };

    /** Opening width of a point at `now`, 0 when healed. */
    const openness = (p: TearPoint, now: number) => {
      const age = now - p.t;
      if (age >= LIFETIME) return 0;
      const open = Math.min(1, age / OPEN_TIME);
      const heal = 1 - Math.pow(age / LIFETIME, 2);
      return open * heal * (0.45 + p.speed * 0.55);
    };

    const buildEdges = (tear: Tear, now: number) => {
      // Keep dense pointer tracking, but draw only every fifth edge detail.
      // Always include the newest sample so the opening stays under the cursor.
      const samples = tear.filter((_, i) => i % EDGE_STRIDE === 0 || i === 1 || i >= tear.length - 2);
      const left: [number, number][] = [];
      const right: [number, number][] = [];
      const n = samples.length;
      const distances = [0];
      for (let i = 1; i < n; i++) {
        distances.push(distances[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
      }
      for (let i = 0; i < n; i++) {
        const p = samples[i];
        const prev = samples[Math.max(0, i - 1)];
        const next = samples[Math.min(n - 1, i + 1)];
        let dx = next.x - prev.x;
        let dy = next.y - prev.y;
        const len = Math.hypot(dx, dy);
        dx = len ? dx / len : 1;
        dy = len ? dy / len : 0;
        const nx = -dy;
        const ny = dx;
        const taper = Math.min(1, distances[i] / (MAX_STEP * 4),
          (distances[n - 1] - distances[i]) / (MAX_STEP * 1.5));
        const w = MAX_WIDTH * openness(p, now) * Math.max(0, taper);
        left.push([p.x + nx * w * p.jl, p.y + ny * w * p.jl]);
        right.push([p.x - nx * w * p.jr, p.y - ny * w * p.jr]);

        // Retain a little torn-paper texture with much shallower deviations.
        if (i < n - 1) {
          const mx = (p.x + next.x) / 2;
          const my = (p.y + next.y) / 2;
          const wl = w * (0.725 + (p.ml - 0.5) * 0.55 * EDGE_DETAIL);
          const wr = w * (0.725 + (p.mr - 0.5) * 0.55 * EDGE_DETAIL);
          left.push([mx + nx * wl + dx * 2 * EDGE_DETAIL, my + ny * wl + dy * 2 * EDGE_DETAIL]);
          right.push([mx - nx * wr - dx * 2 * EDGE_DETAIL, my - ny * wr - dy * 2 * EDGE_DETAIL]);
        }
      }
      return { left, right, samples };
    };

    const tracePolygon = (left: [number, number][], right: [number, number][]) => {
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
    };

    const frame = () => {
      raf = 0;
      const now = performance.now();

      for (let i = tears.length - 1; i >= 0; i--) {
        const alive = tears[i].filter((p) => now - p.t < LIFETIME);
        // Keep the newest tear even with one point: the pointer is still extending it.
        const isGrowing = i === tears.length - 1 && alive.length > 0;
        if (alive.length === 0 || (alive.length < 2 && !isGrowing)) tears.splice(i, 1);
        else tears[i] = alive;
      }

      paintBackground();
      // Bumped before drawing: the photo re-uploads on its next frame, after this one finishes.
      tearSurface.version++;

      if (cursor && now - cursor.t >= LIFETIME) cursor = null;
      if (tears.length === 0 && !cursor) return;

      const cuts: ReturnType<typeof buildEdges>[] = [];

      for (const tear of tears) {
        if (tear.length < 2) continue;
        const cut = buildEdges(tear, now);
        cuts.push(cut);
        const { left, right, samples } = cut;

        // Lifted edges are painted first; cutting the union afterward removes inner seams.
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = 'rgba(60,60,60,0.9)';
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        tracePolygon(left, right);
        ctx.stroke();
        ctx.restore();

        // 3. Bright torn fibres along the rim.
        ctx.strokeStyle = 'rgba(229,229,229,0.22)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < samples.length; i++) {
          const p = samples[i];
          if (p.fiber > 0.55) continue;
          const o = openness(p, now);
          if (o <= 0.05) continue;
          const [lx, ly] = left[Math.min(left.length - 1, i * 2)];
          const [rx, ry] = right[Math.min(right.length - 1, i * 2)];
          const len = 3 + p.fiber * 7 * o;
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + (lx - p.x) * 0.02 * len, ly + (ly - p.y) * 0.02 * len + len * 0.3);
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + (rx - p.x) * 0.02 * len, ry + (ry - p.y) * 0.02 * len - len * 0.3);
        }
        ctx.stroke();

        // 4. Faint phosphor glow on the inner rim.
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = 'rgba(50,215,75,0.5)';
        ctx.lineWidth = 0.6;
        tracePolygon(left, right);
        ctx.stroke();
        ctx.restore();
      }

      const cursorHeal = cursor ? Math.max(0, 1 - Math.pow((now - cursor.t) / LIFETIME, 2)) : 0;
      const withCursor = (draw: () => void) => {
        if (!cursor) return;
        ctx.save();
        ctx.translate(cursor.x, cursor.y);
        ctx.scale(cursorHeal, cursorHeal);
        ctx.lineJoin = 'round';
        draw();
        ctx.restore();
      };
      withCursor(() => {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(100,100,100,0.65)';
        ctx.lineWidth = CURSOR_STROKE + CURSOR_GAP * 2 + 1;
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.stroke(cursorPath);
      });

      // Match the arrow's outline with only 1.5px clearance, merging it into its trail.
      ctx.globalCompositeOperation = 'destination-out';
      for (const { left, right } of cuts) {
        tracePolygon(left, right);
        ctx.fill();
      }
      withCursor(() => {
        ctx.lineWidth = CURSOR_STROKE + CURSOR_GAP * 2;
        ctx.fill(cursorPath);
        ctx.stroke(cursorPath);
      });
      ctx.globalCompositeOperation = 'source-over';

      raf = requestAnimationFrame(frame);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      root.classList.remove('has-tear-cursor');
      root.style.removeProperty('--tear-cursor');
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="tear-canvas" aria-hidden="true" />;
}
