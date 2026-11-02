import type { Metadata } from "next";
import KetapelBuahGame from "@/modules/ketapel-buah/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Ketapel Buah",
  description: "Arena ketapel buah edukasi: Solo, Duel, Trio, dan Quad di satu perangkat.",
};

export default function Page() {
  return <KetapelBuahGame />;
}
