import * as THREE from 'three';

/**
 * Measures how much of a 3D model's on-screen footprint is covered by page text,
 * so the model can fade when it sits behind words (mainly on phones and narrow windows).
 */

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const REFRESH_MS = 200;
let textRects: Rect[] = [];
let measuredAt = -Infinity;

/** Tight boxes around every visible run of text in <main>, refreshed a few times a second. */
function currentTextRects(now: number) {
  if (now - measuredAt < REFRESH_MS) return textRects;
  measuredAt = now;
  const root = document.querySelector('main');
  if (!root) return (textRects = []);
  const vh = window.innerHeight;
  const rects: Rect[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('.sr-only')) continue;
    range.selectNodeContents(node);
    // One rect per wrapped line, so empty space beside short lines is not counted.
    for (const r of range.getClientRects()) {
      if (r.bottom < 0 || r.top > vh || r.width < 1) continue;
      rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
  }
  return (textRects = rects);
}

const corner = new THREE.Vector3();

/** Screen rectangle (CSS px) of an object's bounding box. */
function screenRect(object: THREE.Object3D, box: THREE.Box3, camera: THREE.Camera, width: number, height: number): Rect {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    corner.applyMatrix4(object.matrixWorld).project(camera);
    const x = ((corner.x + 1) / 2) * width;
    const y = ((1 - corner.y) / 2) * height;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom };
}

/** 0..1: share of the object's on-screen area that has text over it. */
export function textCoverage(object: THREE.Object3D, box: THREE.Box3, camera: THREE.Camera, width: number, height: number) {
  const m = screenRect(object, box, camera, width, height);
  // Only the part of the model that is actually on screen matters.
  const l = Math.max(0, m.left), t = Math.max(0, m.top), r = Math.min(width, m.right), b = Math.min(height, m.bottom);
  const area = (r - l) * (b - t);
  if (area <= 1) return 0;
  let covered = 0;
  for (const tr of currentTextRects(performance.now())) {
    const w = Math.min(r, tr.right) - Math.max(l, tr.left);
    const h = Math.min(b, tr.bottom) - Math.max(t, tr.top);
    if (w > 0 && h > 0) covered += w * h;
  }
  return Math.min(1, covered / area);
}
