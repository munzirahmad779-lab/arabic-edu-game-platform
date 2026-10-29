import type { Metadata } from "next";
import SpaceWarGame from "@/modules/space-war/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Perang Antariksa",
  description:
    "Arena perang antariksa: tembak asteroid soal dengan jawaban ketik dan pilihan di satu perangkat (hot-seat).",
};

export default function Page() {
  return <SpaceWarGame />;
}
