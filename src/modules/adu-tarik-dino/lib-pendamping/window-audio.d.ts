// Deklarasi tipe untuk properti AudioContext non-standar milik Safari lama.
// Dengan augmentasi ini, sfx.ts dapat membaca window.webkitAudioContext
// secara type-safe tanpa `as unknown as` / `any`.
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export {};
