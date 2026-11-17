import type { Metadata } from "next";
import { PauseGlobalAudio } from "@/components/pause-global-audio";
import { requireStudent } from "@/lib/student-auth";
import { statusKunciGameSolo } from "@/modules/game-results/solo-lock-server";
import SoloLockNotice from "@/modules/game-results/solo-lock-notice";
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
      <LudoAngkaGame studentMode />
    </>
  );
}
