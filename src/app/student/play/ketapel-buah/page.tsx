import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import { requireStudent } from "@/lib/student-auth";
import KetapelBuahGame from "@/modules/ketapel-buah/modul/Game";

export const metadata: Metadata = {
  title: "Ketapel Buah · Game Solo Siswa",
  description:
    "Ketapel Buah versi siswa: main solo dari akun siswa, hasil tercatat ke server dan tampil di dasbor guru.",
};

/**
 * Jalur siswa untuk Ketapel Buah: gerbang sesi siswa (nama+PIN).
 * Mode siswa memaksakan SOLO dan mencatat hasil akhir ke
 * student_game_results (migrasi 0116). Jalur guru /game/ketapel-buah
 * tidak berubah.
 */
export default async function StudentKetapelBuahPage() {
  await requireStudent();

  return (
    <>
      <PauseGlobalAudio />
      <KetapelBuahGame studentMode />
    </>
  );
}
