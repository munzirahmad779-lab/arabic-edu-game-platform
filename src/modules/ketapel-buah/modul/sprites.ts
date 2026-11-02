/**
 * Ketapel Buah — sprite: maskot + ketapel dipakai bersama dari modul
 * Pappappe'; buah foto Sulawesi dari Banua Fruit Blast.
 */

import { FRUIT_SPRITES } from "@/modules/banua-fruit-blast/modul/sprites";
import type { FruitSpriteId } from "./logic";

export { SPRITES, frameCrop } from "@/modules/ketapel-shared/modul/sprites";
export { SLING_PHOTO } from "@/modules/ketapel-shared/modul/sprites";

const fruitCache = new Map<FruitSpriteId, HTMLImageElement>();

/** Gambar buah termuat malas; null selama belum siap (renderer cadangan). */
export function fruitImage(id: FruitSpriteId): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  let img = fruitCache.get(id);
  if (!img) {
    img = new Image();
    img.src = FRUIT_SPRITES[id].src;
    fruitCache.set(id, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function fruitAspect(id: FruitSpriteId): number {
  return FRUIT_SPRITES[id].aspect;
}

export function fruitJuice(id: FruitSpriteId): string {
  return FRUIT_SPRITES[id].juice;
}
