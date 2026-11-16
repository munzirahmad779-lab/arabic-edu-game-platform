import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import { requireStudent } from "@/lib/student-auth";
import KetapelBurungGame from "@/modules/ketapel-burung/modul/Game";

export const metadata: Metadata = {
  title: "Ketapel Burung · Game Solo Siswa",
  description:
    "Ketapel Burung versi siswa: main solo dari akun siswa, hasil tercatat ke server dan tampil di dasbor guru.",
};

/**
 * Jalur siswa untuk Ketapel Burung: gerbang sesi siswa (nama+PIN).
 * Mode siswa memaksakan SOLO dan mencatat hasil akhir ke
 * student_game_results (migrasi 0116). Jalur guru /game/ketapel-burung
 * tidak berubah.
 */
export default async function StudentKetapelBurungPage() {
  await requireStudent();

  return (
    <>
      <PauseGlobalAudio />
      <KetapelBurungGame studentMode />
    </>
  );
}
