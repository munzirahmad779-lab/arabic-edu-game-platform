import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import DuelStickmanFrame from "@/modules/duel-stickman/play-frame";

export const metadata: Metadata = {
  title: "Arena — Duel Stickman Berpedang",
  description:
    "Arena Duel Stickman Berpedang: pilih pendekar, jawab 5 soal untuk meramu kekuatan, lalu duel pedang 90 detik. Soal dari bank bawaan, bank lokal guru, atau Bank Soal LMS.",
};

export default function Page() {
  return (
    <>
      <PauseGlobalAudio />
      <DuelStickmanFrame />
    </>
  );
}
