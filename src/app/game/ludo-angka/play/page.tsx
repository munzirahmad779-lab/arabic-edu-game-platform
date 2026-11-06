import type { Metadata } from "next";
import LudoAngkaGame from "@/modules/ludo-angka/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Ludo Angka",
  description:
    "Arena Ludo soal: jawab benar untuk melempar dadu, tangkap lawan, balapan ke FINISH di satu perangkat (hot-seat).",
};

export default function Page() {
  return <LudoAngkaGame />;
}
