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

  // Valid slugs intentionally render the lightweight detached placeholder when
  // the optional games-pack is unplugged.
  if (!GAME_PACK_AVAILABLE) return <GamePackRuntime slug={params.gameSlug} />;

  return <GamePackRuntime slug={params.gameSlug} />;
}
