import { useLayoutEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { clamp, layoutTop, smooth } from '../scroll';

type Point = [number, number];

// Block-letter contours, including counters. Each contour becomes a front face,
// a rear face and connecting edges, so the letters themselves are wireframes.
const GLYPHS: Record<string, Point[][]> = {
  A: [[[0, 80], [18, 0], [38, 0], [56, 80], [42, 80], [38, 60], [18, 60], [14, 80]], [[21, 46], [28, 17], [35, 46]]],
  B: [[[0, 0], [36, 0], [52, 12], [52, 30], [44, 39], [56, 49], [56, 67], [42, 80], [0, 80]], [[14, 14], [33, 14], [38, 19], [38, 28], [33, 33], [14, 33]], [[14, 47], [35, 47], [42, 53], [42, 61], [35, 66], [14, 66]]],
  C: [[[56, 0], [56, 14], [20, 14], [14, 20], [14, 60], [20, 66], [56, 66], [56, 80], [12, 80], [0, 68], [0, 12], [12, 0]]],
  E: [[[0, 0], [56, 0], [56, 14], [14, 14], [14, 33], [46, 33], [46, 47], [14, 47], [14, 66], [56, 66], [56, 80], [0, 80]]],
  J: [[[12, 0], [56, 0], [56, 66], [42, 80], [14, 80], [0, 66], [0, 50], [14, 50], [14, 60], [20, 66], [36, 66], [42, 60], [42, 14], [12, 14]]],
  M: [[[0, 80], [0, 0], [14, 0], [28, 28], [42, 0], [56, 0], [56, 80], [42, 80], [42, 28], [28, 53], [14, 28], [14, 80]]],
  N: [[[0, 80], [0, 0], [14, 0], [42, 52], [42, 0], [56, 0], [56, 80], [42, 80], [14, 28], [14, 80]]],
  O: [[[12, 0], [44, 0], [56, 12], [56, 68], [44, 80], [12, 80], [0, 68], [0, 12]], [[20, 14], [36, 14], [42, 20], [42, 60], [36, 66], [20, 66], [14, 60], [14, 20]]],
  P: [[[0, 80], [0, 0], [42, 0], [56, 14], [56, 38], [42, 52], [14, 52], [14, 80]], [[14, 14], [36, 14], [42, 20], [42, 32], [36, 38], [14, 38]]],
  R: [[[0, 80], [0, 0], [42, 0], [56, 14], [56, 38], [43, 50], [56, 80], [40, 80], [27, 52], [14, 52], [14, 80]], [[14, 14], [36, 14], [42, 20], [42, 32], [36, 38], [14, 38]]],
  S: [[[56, 0], [56, 14], [18, 14], [14, 18], [14, 29], [18, 33], [42, 33], [56, 47], [56, 66], [42, 80], [0, 80], [0, 66], [36, 66], [42, 60], [42, 53], [36, 47], [14, 47], [0, 33], [0, 14], [14, 0]]],
  T: [[[0, 0], [56, 0], [56, 14], [35, 14], [35, 80], [21, 80], [21, 14], [0, 14]]],
  U: [[[0, 0], [14, 0], [14, 60], [20, 66], [36, 66], [42, 60], [42, 0], [56, 0], [56, 68], [44, 80], [12, 80], [0, 68]]],
};

function buildFrame(text: string) {
  const vertices: Point[] = [];
  const edges: { a: Point; b: Point; depth: boolean }[] = [];
  let x = 12;
  for (const char of text.toUpperCase()) {
    if (char === ' ') { x += 28; continue; }
    for (const contour of GLYPHS[char]) {
      const points = contour.map(([px, py]): Point => [x + px, 28 + py]);
      points.forEach((a, i) => {
        const b = points[(i + 1) % points.length];
        const back: Point = [a[0] + 9, a[1] - 9];
        vertices.push(a);
        edges.push({ a, b, depth: false });
        edges.push({ a: back, b: [b[0] + 9, b[1] - 9], depth: true });
        edges.push({ a, b: back, depth: true });
      });
    }
    x += 72;
  }
  const stars = [vertices[0], vertices[Math.floor(vertices.length / 2)], vertices[vertices.length - 1]];
  const distance = (point: Point) => Math.min(...stars.map(([sx, sy]) => Math.hypot(point[0] - sx, point[1] - sy)));
  const longest = Math.max(...vertices.map(distance), 1);
  return {
    width: x + 8,
    stars,
    vertices,
    edges: edges.map((edge) => ({
      ...edge,
      start: 0.18 + Math.min(distance(edge.a), distance(edge.b)) / longest * 0.44 + (edge.depth ? 0.1 : 0),
      // Grow each segment from whichever endpoint is nearer a seed star.
      path: distance(edge.a) <= distance(edge.b)
        ? `M${edge.a.join(',')}L${edge.b.join(',')}`
        : `M${edge.b.join(',')}L${edge.a.join(',')}`,
    })),
  };
}

/** A separate scroll interval between the previous section and the next panel. */
export function SectionHeading({ text }: { text: string }) {
  return (
    <header className="section-heading">
      <div className="window">
        <WireframeTitle text={text} />
      </div>
    </header>
  );
}

/** Scroll scrubs the entire assembly in both directions; stopping holds a frame. */
export function WireframeTitle({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  const geometry = useMemo(() => buildFrame(text), [text]);

  useLayoutEffect(() => {
    const title = ref.current;
    if (!title) return;
    const lines = Array.from(title.querySelectorAll<SVGPathElement>('[data-edge]'));
    let frame = 0;
    let top = 0;
    let viewport = 0;
    let maxScroll = 0;
    let previous = -1;
    let needsMeasure = true;
    const update = () => {
      frame = 0;
      if (needsMeasure) {
        top = layoutTop(title);
        viewport = window.innerHeight;
        maxScroll = Math.max(0, document.documentElement.scrollHeight - viewport);
        needsMeasure = false;
      }
      const start = Math.max(0, top - viewport * 0.94);
      const end = Math.min(maxScroll, Math.max(start + 1, top - viewport * 0.28));
      const p = reduced || maxScroll === 0 ? 1 : end <= start
        ? Number(window.scrollY >= end) : clamp((window.scrollY - start) / (end - start));
      if (p === previous) return;
      previous = p;
      title.style.setProperty('--spark', String(smooth(p / 0.2)));
      title.style.setProperty('--nodes', String(smooth((p - 0.22) / 0.56)));
      title.style.setProperty('--settled', String(smooth((p - 0.78) / 0.22)));
      lines.forEach((line, i) => {
        line.style.strokeDashoffset = String(1 - smooth((p - geometry.edges[i].start) / 0.28));
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const measure = () => { needsMeasure = true; schedule(); };
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    observer.observe(title);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('pageshow', measure);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pageshow', measure);
    };
  }, [geometry, reduced]);

  return (
    <h2 className="wireframe-title" ref={ref}>
      <span className="sr-only">{text}</span>
      <svg viewBox={`0 0 ${geometry.width} 132`} aria-hidden="true" focusable="false">
        <g className="wireframe-lines">
          {geometry.edges.map((edge, i) => (
            <path key={i} data-edge d={edge.path} pathLength="1"
              className={edge.depth ? 'wireframe-depth' : 'wireframe-face'} />
          ))}
        </g>
        <g className="wireframe-nodes">
          {geometry.vertices.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" />)}
        </g>
        {geometry.stars.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <g className="wireframe-star">
              <circle r="4" className="wireframe-star-halo" />
              <path d="M-7,0 L-1.4,-1.4 L0,-7 L1.4,-1.4 L7,0 L1.4,1.4 L0,7 L-1.4,1.4 Z" />
            </g>
          </g>
        ))}
      </svg>
    </h2>
  );
}
