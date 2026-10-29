import type { Metadata } from "next";
import { GamePackRuntime } from "@/components/game-pack-runtime";

export const metadata: Metadata = {
  title: "Arena — Banua Fruit Blast",
  description: "Arena petik buah edukasi: Solo, Duel, dan Squad.",
};

export default function Page() {
  return <GamePackRuntime slug="banua-fruit-blast-play" />;
}
