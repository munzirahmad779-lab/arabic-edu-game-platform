export interface GameCatalogEntry {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
}

export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  ["porogapit-arena", "Porogapit Arena"],
  ["math-domino-arena", "Math Domino Arena"],
  ["jejak-angka", "Jejak Angka"],
  ["helirescue", "Heli Rescue"],
  ["sciencelink", "Science Link"],
  ["banua-fruit-blast", "Banua Fruit Blast"],
  ["si-pemanah", "Si Pemanah"],
  ["rimba-pedia", "Rimba Pedia"],
  ["celestial-weaver", "Celestial Weaver"],
  ["tanzib", "Tanzib"],
  ["puzzle", "Puzzle"],
  ["martabak-pecahan", "Martabak Pecahan"],
  ["doodle", "Doodle"],
  ["si-taktik", "Si Taktik"],
  ["traditional", "Traditional"],
  ["space-war", "Space War"],
  ["ai-basketball", "AI Basketball"],
  ["mancing-kata", "Mancing Kata"],
  ["kancil", "Kancil"],
  ["nusaboard", "Nusa Board"],
  ["jagoan-kata", "Jagoan Kata"],
  ["geo-squad", "Geo Squad"],
  ["ruang-io", "Ruang IO"],
  ["gabung-ceria", "Gabung Ceria"],
  ["color-link-junior", "Color Link Junior"],
  ["adu-tarik-dino", "Adu Tarik Dino"],
  ["tatap-hap", "Tatap Hap"],
  ["cocok-logi", "Cocok Logi"],
  ["mesin-koleksi", "Mesin Koleksi"],
  ["pendekar-balon", "Pendekar Balon"],
  ["detektif-cilik", "Detektif Cilik"],
  ["mewarnai", "Mewarnai"],
].map(([slug, title]) => ({
  slug,
  title,
  description: `Game edukasi bahasa Arab: ${title}`,
}));

export const GAME_SLUGS = GAME_CATALOG.map((game) => game.slug);

export function getGameCatalogEntry(slug: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((game) => game.slug === slug);
}
