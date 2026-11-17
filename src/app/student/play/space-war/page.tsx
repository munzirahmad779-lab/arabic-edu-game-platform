import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import { requireStudent } from "@/lib/student-auth";
import { statusKunciGameSolo } from "@/modules/game-results/solo-lock-server";
import SoloLockNotice from "@/modules/game-results/solo-lock-notice";
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

  // Kunci Game Solo (perintah pemilik, 17 Nov 2026): permainan hanya
  // terbuka bila latihan siswa sudah tuntas untuk 7 dars berbeda.
  // Penegakan di server, jadi URL langsung pun tertolak.
  const kunci = await statusKunciGameSolo();
  if (!kunci.terbuka) {
    return <SoloLockNotice jumlahDarsTuntas={kunci.jumlahDarsTuntas} />;
  }

  return (
    <>
      <PauseGlobalAudio />
      <SpaceWarGame studentMode />
    </>
  );
}
