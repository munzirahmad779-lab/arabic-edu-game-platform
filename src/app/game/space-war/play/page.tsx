import type { Metadata } from "next";
import SpaceWarGame from "@/modules/space-war/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Mattembak Angkasa",
  description:
    "Arena Mattembak Angkasa: tembak asteroid soal dengan jawaban ketik dan pilihan di satu perangkat (hot-seat).",
};

export default function Page() {
  return <SpaceWarGame />;
}
