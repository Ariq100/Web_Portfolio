import { smooth } from './scroll';

/** Shared by the section lettering and the 3D wireframes. */
export const WIREFRAME_DRAW = {
  delay: 0.18,
  spread: 0.44,
  depthDelay: 0.1,
  duration: 0.28,
  seconds: 1.6,
};

export const wireEdgeStart = (distance: number, depth = false) =>
  WIREFRAME_DRAW.delay + distance * WIREFRAME_DRAW.spread + (depth ? WIREFRAME_DRAW.depthDelay : 0);

export const wireEdgeProgress = (progress: number, start: number) =>
  smooth((progress - start) / WIREFRAME_DRAW.duration);
