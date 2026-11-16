import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import { requireStudent } from "@/lib/student-auth";
import SpaceWarGame from "@/modules/space-war/modul/Game";

export const metadata: Metadata = {
  title: "Space War · Game Solo Siswa",
  description:
    "Space War (Perang Antariksa) versi siswa: main solo dari akun siswa, hasil tercatat ke server dan tampil di dasbor guru.",
};

/**
 * Jalur siswa untuk Space War: gerbangnya sesi siswa (nama+PIN),
 * bukan sesi guru seperti /game/space-war. Komponen permainan yang
 * sama dipakai ulang dengan mode siswa: mode SOLO dipaksakan dan
 * hasil akhir sesi tercatat ke student_game_results (migrasi 0116).
 * Cara guru memakai /game/space-war tidak berubah.
 */
export default async function StudentSpaceWarPage() {
  await requireStudent();

  return (
    <>
      <PauseGlobalAudio />
      <SpaceWarGame studentMode />
    </>
  );
}
