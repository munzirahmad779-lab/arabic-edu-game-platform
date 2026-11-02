/**
 * Ketapel Burung — sprite: maskot + ketapel dipakai bersama dari modul
 * Pappappe'; burung kartun adalah aset lokal game ini (hasil alur skill
 * gambar: latar chroma dihapus, cek halo 0,0%).
 */

import burungPhoto from "../assets/sprites/burung.png";

export { SPRITES, frameCrop } from "@/modules/ketapel-shared/modul/sprites";
export { SLING_PHOTO } from "@/modules/ketapel-shared/modul/sprites";

let birdImg: HTMLImageElement | null = null;

/** Gambar burung termuat malas; null selama belum siap. */
export const BIRD_PHOTO: { img: HTMLImageElement | null } = {
  get img(): HTMLImageElement | null {
    if (typeof window === "undefined") return null;
    if (!birdImg) {
      birdImg = new Image();
      birdImg.src = burungPhoto.src;
    }
    return birdImg.complete && birdImg.naturalWidth > 0 ? birdImg : null;
  },
};

/** Lebar/tinggi aset burung (560x591). */
export const BIRD_ASPECT = 560 / 591;
