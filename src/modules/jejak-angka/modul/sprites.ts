/**
 * Jejak Angka: sprite maskot. Tiga lembar banua lama (Maleo, Tarsius,
 * Anoa) dipakai ulang dari assets/sprites/banua/; lembar Kuskus adalah
 * produksi baru Log 74 (pipa skill gambar-dan-edit-aset-game: kunci
 * terukur per pose, halo 0,0% TERIMA, cek_kisi TERIMA). Lembar Kuskus
 * lama diganti karena isinya delapan sosok kecil susunan 4x2, bukan
 * empat pose sel 256. Babirusa (produksi Log 72) pensiun pada Log 76
 * atas perintah user dan digantikan Maleo di slot 0.
 * Kisi 2x2 per karakter, sel 256 px: 0 senang, 1 siap, 2 terkejut,
 * 3 gagal. frameCrop dan FRAME diambil dari ketapel-shared.
 */

import anoaSheet from "../assets/sprites/banua/anoa_sheet.png";
import kuskusSheet from "../assets/sprites/banua/kuskus_sheet.png";
import maleoSheet from "../assets/sprites/banua/maleo_sheet.png";
import tarsiusSheet from "../assets/sprites/banua/tarsius_sheet.png";
import type { SpriteId } from "./logic";

export { frameCrop, FRAME } from "@/modules/ketapel-shared/modul/sprites";
export type { FrameCrop } from "@/modules/ketapel-shared/modul/sprites";

export interface JejakSpriteDef {
  id: SpriteId;
  label: string;
  src: string;
  fallback: string;
}

export const SPRITES: Record<SpriteId, JejakSpriteDef> = {
  maleo: { id: "maleo", label: "Maleo", src: maleoSheet.src, fallback: "#4C1D95" },
  tarsius: { id: "tarsius", label: "Tarsius", src: tarsiusSheet.src, fallback: "#1F7A72" },
  anoa: { id: "anoa", label: "Anoa", src: anoaSheet.src, fallback: "#4E9B47" },
  kuskus: { id: "kuskus", label: "Kuskus", src: kuskusSheet.src, fallback: "#D9A404" },
};

/**
 * Jarak isi tokoh dari tepi bawah sel per bingkai (px pada sel 256),
 * terukur dari piksel alfa terbawah tiap sel: maleo 29/10/10/27;
 * anoa 10 di semua sel; tarsius 19/10/15/27; kuskus 0 di semua sel
 * (rakitan baru Log 74; lembar lamanya 62/64/87/88).
 * Renderer menggeser gambar turun sebesar ini agar telapak semua
 * maskot menyentuh garis tanah yang sama.
 */
export const FRAME_INSET: Record<SpriteId, readonly number[]> = {
  maleo: [29, 10, 10, 27],
  tarsius: [19, 10, 15, 27],
  anoa: [10, 10, 10, 10],
  kuskus: [0, 0, 0, 0],
};
