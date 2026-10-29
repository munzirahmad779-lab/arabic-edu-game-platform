/**
 * Banua Fruit Blast — daftar sprite & pemotongan frame.
 *
 * Berkas gambar di public/sprites/banua/ berisi grid 2x2 (4 frame) per karakter:
 *   {anoa,tarsius,maleo,kuskus}_sheet.png  → 512x512, sel 256x256, latar transparan.
 *
 * Urutan frame disepakati: 0 senang, 1 siap, 2 terkejut, 3 gagal.
 * Kalau gambar gagal dimuat, renderer menggambar maskot prosedural (tidak crash).
 */

import type { SpriteId } from "./logic";
import anoaSheet from "../assets/sprites/banua/anoa_sheet.png";
import kuskusSheet from "../assets/sprites/banua/kuskus_sheet.png";
import maleoSheet from "../assets/sprites/banua/maleo_sheet.png";
import tarsiusSheet from "../assets/sprites/banua/tarsius_sheet.png";

export const SHEET_COLS = 2;
export const SHEET_ROWS = 2;
export const CELL = 256;

export interface SpriteDef {
  id: SpriteId;
  /** nama tampilan di panel */
  label: string;
  src: string;
  /** warna aksen kalau gambar gagal dimuat */
  fallback: string;
}

export const SPRITES: Record<SpriteId, SpriteDef> = {
  anoa: {
    id: "anoa",
    label: "Anoa",
    src: anoaSheet.src,
    fallback: "#C2410C",
  },
  tarsius: {
    id: "tarsius",
    label: "Tarsius",
    src: tarsiusSheet.src,
    fallback: "#0F5E63",
  },
  maleo: {
    id: "maleo",
    label: "Maleo",
    src: maleoSheet.src,
    fallback: "#4C1D95",
  },
  kuskus: {
    id: "kuskus",
    label: "Kuskus",
    src: kuskusSheet.src,
    fallback: "#831843",
  },
};

/** Indeks frame untuk tiap keadaan peserta (0..3 sesuai urutan grid 2x2). */
export const FRAME = {
  happy: 0,
  ready: 1,
  shock: 2,
  miss: 3,
} as const;

/** Indeks frame numerik — dipakai sebagai nilai mood peserta. */
export type FrameIndex = number;

export interface FrameCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function frameCrop(index: number): FrameCrop {
  const safe = ((index % 4) + 4) % 4;
  const col = safe % SHEET_COLS;
  const row = Math.floor(safe / SHEET_COLS);
  return { sx: col * CELL, sy: row * CELL, sw: CELL, sh: CELL };
}

export const spriteSrc = (id: SpriteId): string => SPRITES[id].src;
export const spriteLabel = (id: SpriteId): string => SPRITES[id].label;

/* ------------------------------------------------------- buah foto asli
 * Sprite buah khas Sulawesi + bom + buah emas: hasil generate AI yang
 * di-chroma-key (latar hijau -> transparan) dari folder buah-sulawesi,
 * disimpan di assets/sprites/fruit/. Dipakai renderer sebagai buah yang
 * dipotong; bom & emas hanya tampil saat isi buah terbuka. */

import markisaImg from "../assets/sprites/fruit/markisa.png";
import langsatImg from "../assets/sprites/fruit/langsat.png";
import durianImg from "../assets/sprites/fruit/durian.png";
import pameloImg from "../assets/sprites/fruit/pamelo.png";
import terongBelandaImg from "../assets/sprites/fruit/terong-belanda.png";
import kakaoImg from "../assets/sprites/fruit/kakao.png";
import bomImg from "../assets/sprites/fruit/bom.png";
import buahEmasImg from "../assets/sprites/fruit/buah-emas.png";
import type { FruitSpriteId } from "./logic";

export interface FruitSpriteMeta {
  src: string;
  /** lebar / tinggi gambar asli */
  aspect: number;
  /** warna jus untuk ledakan partikel saat buah ini dipotong */
  juice: string;
}

export const FRUIT_SPRITES: Record<FruitSpriteId, FruitSpriteMeta> = {
  markisa: { src: markisaImg.src, aspect: 0.653, juice: "#F59E0B" },
  langsat: { src: langsatImg.src, aspect: 0.815, juice: "#FDE68A" },
  durian: { src: durianImg.src, aspect: 0.858, juice: "#FDE047" },
  pamelo: { src: pameloImg.src, aspect: 0.957, juice: "#FCA5A5" },
  "terong-belanda": { src: terongBelandaImg.src, aspect: 0.540, juice: "#EF4444" },
  kakao: { src: kakaoImg.src, aspect: 0.518, juice: "#F97316" },
};

export const BOM_SRC: string = bomImg.src;
export const EMAS_SRC: string = buahEmasImg.src;
