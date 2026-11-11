import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import BasketGame from "@/modules/ai-basketball/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Mabbasket",
  description:
    "Arena Mabbasket: dua tim menjawab soal dan melempar bola ke ring di satu perangkat (hot-seat).",
};

export default function Page() {
  return (
    <>
      <PauseGlobalAudio />
      <BasketGame />
    </>
  );
}
