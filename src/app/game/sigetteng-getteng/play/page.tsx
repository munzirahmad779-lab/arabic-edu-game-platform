import type { Metadata } from "next";
import SigettengGettengGame from "@/modules/sigetteng-getteng/modul/Game";

export const metadata: Metadata = {
  title: "Arena — Sigetteng-Getteng",
  description:
    "Arena tarik tambang pengetahuan: duel 1v1 dan squad 2v2 di satu perangkat (hot-seat).",
};

export default function Page() {
  return <SigettengGettengGame />;
}
