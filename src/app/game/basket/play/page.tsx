import type { Metadata } from "next";
import BasketGame from "@/modules/ai-basketball/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Basket Pengetahuan",
  description:
    "Arena basket pengetahuan: dua tim menjawab soal dan melempar bola ke ring di satu perangkat (hot-seat).",
};

export default function Page() {
  return <BasketGame />;
}
