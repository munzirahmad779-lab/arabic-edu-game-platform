/**
 * Potongan kecil dari katalog game proyek mandiri: kedua game hanya
 * memakai hasArabic dari katalog itu, jadi hanya fungsi ini yang dibawa.
 */
export function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}
