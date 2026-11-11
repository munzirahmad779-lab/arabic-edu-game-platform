import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import LudoAngkaGame from "@/modules/ludo-angka/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Maccule Ludo",
  description:
    "Arena Ludo soal: jawab benar untuk melempar dadu, tangkap lawan, balapan ke FINISH di satu perangkat (hot-seat).",
};

export default function Page() {
  return (
    <>
      <PauseGlobalAudio />
      <LudoAngkaGame />
    </>
  );
}
