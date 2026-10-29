import type { Metadata } from "next";
import { GamePackRuntime } from "@/components/game-pack-runtime";

export const metadata: Metadata = {
  title: "Arena — Adu Tarik Cerdas SMA",
  description: "Arena tarik tambang pengetahuan SMA: duel 1v1 dan squad 2v2.",
};

export default function Page() {
  return <GamePackRuntime slug="adu-tarik-dino-play" />;
}
