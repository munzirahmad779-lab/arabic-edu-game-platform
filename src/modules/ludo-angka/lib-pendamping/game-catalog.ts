/**
 * Potongan kecil dari katalog game proyek mandiri: game ini hanya
 * memakai hasArabic dari katalog itu, jadi hanya fungsi ini yang dibawa
 * (pola yang sama dengan lib-pendamping/game-catalog modul ketapel).
 */
export function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}
