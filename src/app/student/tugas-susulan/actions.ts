"use server";

import { createClient } from "@/lib/supabase/server";
import { getStudentToken } from "@/lib/student-auth";

export async function startCatchupStep(
  darsNo: number,
  step: "baca" | "game",
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
  step: "baca" | "game",
): Promise<{ ok: boolean; ditolakWaktu?: boolean }> {
  const token = await getStudentToken();
  if (!token) return { ok: false, ditolakWaktu: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_catchup_step_complete", {
    p_token: token,
    p_dars: darsNo,
    p_step: step,
  });

  if (error) {
    console.error("[completeCatchupStep]", error);
    return { ok: false, ditolakWaktu: false };
  }

  // RPC mengembalikan false KHUSUS bila penegakan waktu minimal
  // server menolak (langkah bertimer belum dibuka atau belum
  // 7 menit sejak dibuka); kegagalan lain selalu tiba sebagai error
  // di atas. Keduanya dibedakan ke klien (ditolakWaktu) supaya pesan
  // ke siswa jujur: pesan aturan 7 menit hanya untuk penolakan
  // waktu, pesan umum untuk galat jaringan/sesi (audit 18 Nov:
  // sebelumnya semua kegagalan menyalahkan aturan 7 menit).
  return { ok: data === true, ditolakWaktu: data === false };
}
