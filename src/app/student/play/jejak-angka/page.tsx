import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import { requireStudent } from "@/lib/student-auth";
import JejakAngkaGame from "@/modules/jejak-angka/modul/Game";

export const metadata: Metadata = {
  title: "Jejak Angka · Game Solo Siswa",
  description:
    "Jejak Angka versi siswa: balapan melawan bot dari akun siswa, hasil tercatat ke server dan tampil di dasbor guru.",
};

/**
 * Jalur siswa untuk Jejak Angka: gerbang sesi siswa (nama+PIN).
 * Mode siswa memaksakan SOLO (lawan bot) dan mencatat hasil akhir ke
 * student_game_results (migrasi 0116). Jalur guru /game/jejak-angka
 * tidak berubah.
 */
export default async function StudentJejakAngkaPage() {
  await requireStudent();

  return (
    <>
      <PauseGlobalAudio />
      <JejakAngkaGame studentMode />
    </>
  );
}
