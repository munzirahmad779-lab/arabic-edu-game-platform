import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import KetapelBurungGame from "@/modules/ketapel-burung/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Ketapel Burung",
  description: "Arena ketapel burung edukasi: Solo, Duel, Trio, dan Quad di satu perangkat.",
};

export default function Page() {
  return (
    <>
      <PauseGlobalAudio />
      <KetapelBurungGame />
    </>
  );
}
