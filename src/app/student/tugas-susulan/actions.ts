"use server";

import { createClient } from "@/lib/supabase/server";
import { getStudentToken } from "@/lib/student-auth";

export async function startCatchupStep(
  darsNo: number,
  step: "baca" | "kosakata" | "qawaid" | "game",
): Promise<{ ok: boolean; startedAt: string | null }> {
  const token = await getStudentToken();
  if (!token) return { ok: false, startedAt: null };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_catchup_step_start", {
    p_token: token,
    p_dars: darsNo,
    p_step: step,
  });

  if (error) {
    console.error("[startCatchupStep]", error);
    return { ok: false, startedAt: null };
  }

  return { ok: true, startedAt: typeof data === "string" ? data : null };
}

export async function completeCatchupStep(
  darsNo: number,
  step: "baca" | "kosakata" | "qawaid" | "game",
): Promise<{ ok: boolean }> {
  const token = await getStudentToken();
  if (!token) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_catchup_step_complete", {
    p_token: token,
    p_dars: darsNo,
    p_step: step,
  });

  if (error) {
    console.error("[completeCatchupStep]", error);
    return { ok: false };
  }

  // RPC mengembalikan false bila penegakan timer server menolak
  // (langkah kosakata/qawaid belum 7 menit sejak dibuka).
  return { ok: data === true };
}
