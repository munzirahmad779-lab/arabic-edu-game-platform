/**
 * Token gerak global — dipakai semua motif animasi.
 * Nilai sengaja dipilih sendiri, bukan meniru timing aplikasi lain.
 */

export const DUR = {
  quick: 120,
  base: 240,
  emphasis: 420,
  cinematic: 1200,
} as const;

export const EASE = {
  out: "cubic-bezier(.2,.9,.25,1)",
  in: "cubic-bezier(.5,0,.9,.4)",
  jelly: "cubic-bezier(.34,1.56,.64,1)",
} as const;

export const SPRING = {
  soft: { k: 120, c: 18 },
  snappy: { k: 260, c: 24 },
} as const;

export const PARTICLE_BUDGET = 180;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Kualitas gerak: hormati preferensi sistem. */
export function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
