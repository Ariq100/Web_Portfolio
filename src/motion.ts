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

    // Scroll-linked 3D entrance for every element marked with data-depth.
    const vh = window.innerHeight;
    document.querySelectorAll<HTMLElement>('[data-depth]').forEach((el) => {
      const r = el.getBoundingClientRect();
      // 0 when the top of the element is at the bottom of the viewport, 1 once it reaches 35% height.
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.65)));
      el.style.setProperty('--p', p.toFixed(4));
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
