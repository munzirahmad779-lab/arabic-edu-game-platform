import type { Metadata } from "next";
import AduTarikDinoGame from "@/modules/adu-tarik-dino/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Adu Tarik Cerdas SMA",
  description: "Arena tarik tambang pengetahuan SMA: duel 1v1 dan squad 2v2.",
};

export default function Page() {
  return <AduTarikDinoGame />;
}
