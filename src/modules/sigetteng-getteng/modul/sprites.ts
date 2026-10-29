/**
 * Definisi karakter & pemotongan sprite sheet.
 *
 * Gambar yang diharapkan (Anda simpan di public/sprites/characters/):
 *   maleo_sheet.png, tarsius_sheet.png, yaki_sheet.png, anoa_sheet.png
 *
 * Format: 1 file = 1 karakter, berisi grid 2x2 frame (lihat FRAME_MAP).
 * Latar belakang harus transparan (PNG), bukan putih.
 *
 * Kalau gambar belum ada / gagal dimuat, game tetap jalan: canvas menggambar
 * bentuk placeholder prosedural (lihat Game.tsx -> drawPlaceholder).
 */

import anoaSheet from "../assets/sprites/characters/anoa_sheet.png";
import maleoSheet from "../assets/sprites/characters/maleo_sheet.png";
import tarsiusSheet from "../assets/sprites/characters/tarsius_sheet.png";
import yakiSheet from "../assets/sprites/characters/yaki_sheet.png";

export interface CharacterConfig {
  id: string;
  name: string;
  src: string;
  defaultFacing: "left" | "right";
  accent: string;
  /** 2 kolom x 2 baris */
  cols: number;
  rows: number;
}

export const CHARACTERS: Record<string, CharacterConfig> = {
  maleo: {
    id: "maleo",
    name: "Maleo Gesit",
    src: maleoSheet.src,
    defaultFacing: "left",
    accent: "#f6c667",
    cols: 2,
    rows: 2,
  },
  tarsius: {
    id: "tarsius",
    name: "Tarsius Lincah",
    src: tarsiusSheet.src,
    defaultFacing: "right",
    accent: "#f2a6c4",
    cols: 2,
    rows: 2,
  },
  yaki: {
    id: "yaki",
    name: "Yaki Juara",
    src: yakiSheet.src,
    defaultFacing: "left",
    accent: "#ffd166",
    cols: 2,
    rows: 2,
  },
  anoa: {
    id: "anoa",
    name: "Anoa Perkasa",
    src: anoaSheet.src,
    defaultFacing: "left",
    accent: "#ef8f6a",
    cols: 2,
    rows: 2,
  },
};

/** Frame 0 siaga | 1 goyah/terkejut | 2 mulai menarik | 3 hentakan penuh */
export const FRAME = {
  idle: 0,
  shake: 1,
  pull: 2,
  lunge: 3,
} as const;

/**
 * Pembagian tim sesuai permintaan:
 *   kiri  = Tarsius + Anoa
 *   kanan = Maleo + Yaki
 * DUEL memakai elemen pertama, SQUAD memakai keduanya.
 */
export const SIDE_CHARS = {
  left: ["tarsius", "anoa"],
  right: ["maleo", "yaki"],
} as const;

export const TEAM_LABEL = {
  left: "TIM TARSIUS",
  right: "TIM MALEO",
} as const;

export interface FrameCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function getFrameCrop(
  frameIndex: number,
  imgWidth: number,
  imgHeight: number,
  cols = 2,
  rows = 2,
): FrameCrop {
  const fw = imgWidth / cols;
  const fh = imgHeight / rows;
  const col = frameIndex % cols;
  const row = Math.floor(frameIndex / cols);
  return {
    sx: col * fw,
    sy: row * fh,
    sw: fw,
    sh: fh,
  };
}
