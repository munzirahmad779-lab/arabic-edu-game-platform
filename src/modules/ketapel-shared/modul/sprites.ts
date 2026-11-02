/**
 * Ketapel bersama — sprite maskot (lembar banua yang sama dengan Fruit
 * Blast dan Perang Antariksa) dan foto ketapel kayu. Dipakai bersama
 * oleh Ketapel Buah dan Ketapel Burung (dulu modul Pappappe', Log 69).
 * Grid 2x2 per karakter di assets/sprites/banua/:
 * 0 senang, 1 siap, 2 terkejut, 3 gagal.
 */

import anoaSheet from "../assets/sprites/banua/anoa_sheet.png";
import kuskusSheet from "../assets/sprites/banua/kuskus_sheet.png";
import maleoSheet from "../assets/sprites/banua/maleo_sheet.png";
import tarsiusSheet from "../assets/sprites/banua/tarsius_sheet.png";
import ketapelPhoto from "../assets/sprites/ketapel.png";

export type SpriteId = "anoa" | "tarsius" | "maleo" | "kuskus";

export const SHEET_COLS = 2;
export const SHEET_ROWS = 2;
export const CELL = 256;

export interface SpriteDef {
  id: SpriteId;
  label: string;
  src: string;
  fallback: string;
}

export const SPRITES: Record<SpriteId, SpriteDef> = {
  anoa: { id: "anoa", label: "Anoa", src: anoaSheet.src, fallback: "#C2410C" },
  tarsius: { id: "tarsius", label: "Tarsius", src: tarsiusSheet.src, fallback: "#0F5E63" },
  maleo: { id: "maleo", label: "Maleo", src: maleoSheet.src, fallback: "#4C1D95" },
  kuskus: { id: "kuskus", label: "Kuskus", src: kuskusSheet.src, fallback: "#831843" },
};

export const FRAME = { happy: 0, ready: 1, shock: 2, miss: 3 } as const;
export type FrameIndex = number;

export interface FrameCrop { sx: number; sy: number; sw: number; sh: number }

export function frameCrop(index: number): FrameCrop {
  const safe = ((index % 4) + 4) % 4;
  const col = safe % SHEET_COLS;
  const row = Math.floor(safe / SHEET_COLS);
  return { sx: col * CELL, sy: row * CELL, sw: CELL, sh: CELL };
}

/** Ilustrasi ketapel kayu gaya kartun (aset skill gambar; halo 0,0%).
 * Ujung garpu terukur: kiri (0,2155; 0,0007), kanan (0,7837; 0,0033). */
let slingImg: HTMLImageElement | null = null;
export const SLING_PHOTO: { img: HTMLImageElement | null } = {
  get img(): HTMLImageElement | null {
    if (typeof window === "undefined") return null;
    if (!slingImg) {
      slingImg = new Image();
      slingImg.src = ketapelPhoto.src;
    }
    return slingImg;
  },
};
