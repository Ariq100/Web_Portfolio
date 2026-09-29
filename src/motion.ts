import { clamp, introProgress, smooth } from './scroll';

/**
 * Mutable pointer/scroll state shared by the 3D scene, the tear canvas and CSS.
 * Kept outside React so per-frame updates never trigger re-renders.
 */
export const motion = {
  /** Raw pointer position in CSS pixels. */
  x: -1,
  y: -1,
  /** Target pointer position normalised to -1..1. */
  tx: 0,
  ty: 0,
  /** Smoothed pointer position normalised to -1..1. */
  mx: 0,
  my: 0,
  /** Page scroll progress 0..1. */
  scroll: 0,
};

let started = false;

/** Starts one global listener loop that writes pointer/scroll values to `motion` and CSS vars. */
export function startMotionLoop(): () => void {
  if (started) return () => {};
  started = true;
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel'));

  const onPointer = (e: PointerEvent) => {
    motion.x = e.clientX;
    motion.y = e.clientY;
    motion.tx = (e.clientX / window.innerWidth) * 2 - 1;
    motion.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    motion.scroll = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };

  let raf = 0;
  const tick = () => {
    motion.mx += (motion.tx - motion.mx) * 0.08;
    motion.my += (motion.ty - motion.my) * 0.08;
    root.style.setProperty('--mx', motion.mx.toFixed(4));
    root.style.setProperty('--my', motion.my.toFixed(4));
    root.style.setProperty('--scroll', motion.scroll.toFixed(4));

    // Measure stable sections rather than the content being transformed.
    const vh = window.innerHeight;
    panels.forEach((panel) => {
      const r = panel.getBoundingClientRect();
      const p = reduced.matches ? 1 : smooth((vh * 0.9 - r.top) / (vh * 0.45));
      panel.style.setProperty('--p', p.toFixed(4));
      if (panel.id === 'home') {
        const nav = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h'));
        const intro = introProgress(window.scrollY, r.top + window.scrollY, r.height, vh, nav);
        panel.style.setProperty('--intro-exit', String(reduced.matches ? 0 : smooth(clamp((intro - 0.8) / 0.2))));
      }
    });
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  raf = requestAnimationFrame(tick);

  return () => {
    started = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}
