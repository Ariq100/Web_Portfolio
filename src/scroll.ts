/** Pure scroll math: a position always produces the same frame, in either direction. */
export const clamp = (value: number) => Math.min(1, Math.max(0, value));

export const smooth = (value: number) => {
  const p = clamp(value);
  return p * p * (3 - 2 * p);
};

/** Read layout coordinates, never animated bounding boxes (which cause feedback). */
export function layoutTop(element: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = element;
  while (current) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return top;
}

export function rowProgress(top: number, height: number, scrollY: number, viewport: number, maxScroll: number) {
  // Start near the bottom, finish in the reading area. Large cards get a longer reveal.
  const distance = Math.min(viewport * 0.34, Math.max(100, height * 0.7));
  const start = Math.max(0, top - viewport * 0.92);
  // Compress the final reveals so all contact links are fully visible at the bottom.
  const end = Math.min(maxScroll, Math.max(start + 1, top - viewport * 0.92 + distance));
  if (maxScroll <= 0) return 1;
  if (end <= start) return scrollY >= end ? 1 : 0;
  return clamp((scrollY - start) / (end - start));
}

export function introProgress(scrollY: number, top: number, height: number, viewport: number, navHeight: number) {
  return clamp((scrollY - top + navHeight) / Math.max(1, height - viewport + navHeight));
}

export function introRowProgress(progress: number, index: number, count: number) {
  const start = 0.06 + (index / Math.max(1, count)) * 0.66;
  return clamp((progress - start) / 0.11);
}
