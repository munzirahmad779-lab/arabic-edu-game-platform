"use server";

import { createClient } from "@/lib/supabase/server";
import { getStudentToken } from "@/lib/student-auth";

/**
 * Simpan jawaban Post Tes VN sesudah berkas rekamannya terunggah ke
 * Google Drive lewat /api/student/post-test/upload. RPC menolak
 * (post_test_closed) bila guru belum membuka post tes.
 */
export async function savePostTestAnswer(
  questionId: string,
  driveFileId: string,
  driveLink: string,
  durasiDetik: number,
): Promise<{ ok: boolean; closed?: boolean }> {
  const token = await getStudentToken();
  if (!token) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_save_post_test_answer", {
    p_token: token,
    p_question_id: questionId,
    p_drive_file_id: driveFileId,
    p_drive_link: driveLink,
    p_durasi_detik: durasiDetik,
  });

  if (error) {
    console.error("[savePostTestAnswer]", error);
    return {
      ok: false,
      closed: error.message?.includes("post_test_closed") ?? false,
    };
  }

  return { ok: data === true };
}
