/**
 * Shared motion & rendering tokens for every game engine.
 * Kept dependency-free so canvas renderers can import it safely.
 */

/** Hard cap for live particles per arena — protects 60 FPS on low-end phones. */
export const PARTICLE_BUDGET = 220;

/** Target frame time (ms) used by fixed-step engines. */
export const FRAME_MS = 1000 / 60;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential easing toward a target. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Deterministic pseudo-random generator (mulberry32) for reproducible shuffles. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Simple AABB hit test for touch/click hit-testing on canvas layouts. */
export function hitTest(
  x: number,
  y: number,
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
