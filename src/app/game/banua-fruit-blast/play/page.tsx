import type { Metadata } from "next";
import BanuaFruitBlastGame from "@/modules/banua-fruit-blast/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Banua Fruit Blast",
  description: "Arena petik buah edukasi: Duel, Trio, dan Squad di satu perangkat.",
};

export default function Page() {
  return <BanuaFruitBlastGame />;
}
