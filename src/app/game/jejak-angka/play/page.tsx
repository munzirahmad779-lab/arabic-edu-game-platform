import type { Metadata } from "next";
import JejakAngkaGame from "@/modules/jejak-angka/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Mallaleng Angka",
  description:
    "Arena ular tangga sembunyi: jawab soal untuk melempar dadu, balapan ke kotak 100 di satu perangkat (hot-seat).",
};

export default function Page() {
  return <JejakAngkaGame />;
}
