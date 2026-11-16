import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import { requireStudent } from "@/lib/student-auth";
import LudoAngkaGame from "@/modules/ludo-angka/modul/Game";

export const metadata: Metadata = {
  title: "Ludo Angka · Game Solo Siswa",
  description:
    "Ludo Angka versi siswa: main melawan bot dari akun siswa, hasil tercatat ke server dan tampil di dasbor guru.",
};

/**
 * Jalur siswa untuk Ludo Angka: gerbang sesi siswa (nama+PIN).
 * Mode siswa memaksakan SOLO (lawan bot) dan mencatat hasil akhir ke
 * student_game_results (migrasi 0116). Jalur guru /game/ludo-angka
 * tidak berubah.
 */
export default async function StudentLudoAngkaPage() {
  await requireStudent();

  return (
    <>
      <PauseGlobalAudio />
      <LudoAngkaGame studentMode />
    </>
  );
}
