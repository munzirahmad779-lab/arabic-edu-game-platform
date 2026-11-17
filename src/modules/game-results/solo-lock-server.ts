import { createClient } from "@/lib/supabase/server";
import { getStudentToken } from "@/lib/student-auth";
import {
  gameSoloTerbuka,
  hitungDarsTuntas,
  type LatihanRingkasan,
} from "./solo-lock";

export type StatusKunciGameSolo = {
  terbuka: boolean;
  jumlahDarsTuntas: number;
};

/**
 * Status kunci Game Solo untuk siswa yang sedang masuk, dibaca dari
 * RPC student_list_practice_games yang sama dengan halaman Latihan
 * Mandiri. Gagal aman: token kosong, RPC gagal, atau data kosong
 * berarti terkunci, supaya permainan tidak terbuka karena kekeliruan
 * data.
 */
export async function statusKunciGameSolo(): Promise<StatusKunciGameSolo> {
  const token = await getStudentToken();
  if (!token) return { terbuka: false, jumlahDarsTuntas: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_list_practice_games", {
    p_token: token,
  });

  if (error || !data) {
    if (error) console.error("[statusKunciGameSolo]", error);
    return { terbuka: false, jumlahDarsTuntas: 0 };
  }

  const games = data as LatihanRingkasan[];
  return {
    terbuka: gameSoloTerbuka(games),
    jumlahDarsTuntas: hitungDarsTuntas(games),
  };
}
