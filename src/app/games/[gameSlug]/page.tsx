import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamePackRuntime } from "@/components/game-pack-runtime";
import { GAME_PACK_AVAILABLE } from "@/modules/games-pack/games-registry";
import { GAME_CATALOG, getGameCatalogEntry } from "@/lib/game-catalog";

export const dynamicParams = false;

export function generateStaticParams() {
  return GAME_CATALOG.map(({ slug }) => ({ gameSlug: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { gameSlug: string };
}): Promise<Metadata> {
  const game = getGameCatalogEntry(params.gameSlug);
  return {
    title: `${game?.title ?? "Game"} · Magguru`,
    description: game?.description ?? "Game edukasi Magguru",
  };
}

export default function GamePage({ params }: { params: { gameSlug: string } }) {
  if (!getGameCatalogEntry(params.gameSlug)) notFound();

  // Selama games-pack dilepas (GAME_PACK_AVAILABLE = false), slug katalog
  // yang sah pun harus menjawab 404, bukan halaman placeholder "Game pack
  // sedang dilepas": halaman mati itu terindeks mesin pencari dan, untuk
  // slug yang bertabrakan nama dengan game standalone, membuat guru/siswa
  // mengira game-nya rusak padahal yang hidup ada di /game/<slug>.
  if (!GAME_PACK_AVAILABLE) notFound();

  return <GamePackRuntime slug={params.gameSlug} />;
}
