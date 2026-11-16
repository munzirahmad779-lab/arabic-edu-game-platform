"use server";

import { createClient } from "@/lib/supabase/server";
import { getStudentToken } from "@/lib/student-auth";

/**
 * Catat hasil akhir satu sesi permainan solo siswa ke server lewat RPC
 * student_submit_game_result (migrasi 0116). Token sesi siswa dibaca
 * dari cookie httpOnly di server, tidak pernah terekspos ke klien.
 * Dipanggil helper klien submitStudentGameResult; mode guru tidak
 * memakai jalur ini sama sekali.
 */
export async function submitGameResultAction(
  gameSlug: string,
  score: number,
  correct: number,
  total: number,
): Promise<{ ok: boolean }> {
  const token = await getStudentToken();
  if (!token) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_submit_game_result", {
    p_token: token,
    p_game_slug: gameSlug,
    p_score: score,
    p_correct: correct,
    p_total: total,
  });

  if (error) {
    console.error("[submitGameResultAction]", error);
    return { ok: false };
  }

  return { ok: data === true };
}
