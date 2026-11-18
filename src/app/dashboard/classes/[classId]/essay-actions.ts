"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function readString(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function readInt(fd: FormData, key: string, min: number, max: number) {
  const n = Number(readString(fd, key));
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < min || r > max) return null;
  return r;
}

export async function createEssay(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const classId = readString(formData, "class_id");
  const title = readString(formData, "title");
  const theme = readString(formData, "theme");
  const questionText = readString(formData, "question_text");
  const idealAnswer = readString(formData, "ideal_answer");
  const durationMinutes = readInt(formData, "duration_minutes", 5, 180);
  const rubricContent = readInt(formData, "rubric_content", 0, 100);
  const rubricGrammar = readInt(formData, "rubric_grammar", 0, 100);
  const rubricVocabulary = readInt(formData, "rubric_vocabulary", 0, 100);

  if (!classId) redirect("/dashboard/classes");

  if (!title || title.length > 200) {
    redirect(`/dashboard/classes/${classId}?essay_error=invalid_title`);
  }
  if (!questionText || questionText.length > 5000) {
    redirect(`/dashboard/classes/${classId}?essay_error=invalid_question`);
  }
  if (theme.length > 300) {
    redirect(`/dashboard/classes/${classId}?essay_error=invalid_theme`);
  }
  if (idealAnswer.length > 5000) {
    redirect(`/dashboard/classes/${classId}?essay_error=invalid_ideal_answer`);
  }
  if (durationMinutes === null) {
    redirect(`/dashboard/classes/${classId}?essay_error=invalid_duration`);
  }
  if (
    rubricContent === null ||
    rubricGrammar === null ||
    rubricVocabulary === null
  ) {
    redirect(`/dashboard/classes/${classId}?essay_error=invalid_rubric`);
  }

  const rubTotal = rubricContent + rubricGrammar + rubricVocabulary;
  if (rubTotal !== 100) {
    redirect(`/dashboard/classes/${classId}?essay_error=rubric_sum`);
  }

  const { data: classRow } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!classRow) {
    redirect("/dashboard/classes?error=not_found");
  }

  const { error } = await supabase.from("essay_assignments").insert({
    teacher_id: user.id,
    class_id: classId,
    title,
    theme: theme || null,
    question_text: questionText,
    ideal_answer: idealAnswer || null,
    duration_minutes: durationMinutes,
    rubric_content: rubricContent,
    rubric_grammar: rubricGrammar,
    rubric_vocabulary: rubricVocabulary,
    is_published: false,
  });

  if (error) {
    console.error("[createEssay]", error);
    redirect(
      `/dashboard/classes/${classId}?essay_error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}?essay_created=1`);
}

export async function toggleEssayPublish(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const essayId = readString(formData, "essay_id");
  const classId = readString(formData, "class_id");
  const current = readString(formData, "current_published") === "true";

  if (!essayId || !classId) redirect("/dashboard/classes");

  const { error } = await supabase
    .from("essay_assignments")
    .update({ is_published: !current, updated_at: new Date().toISOString() })
    .eq("id", essayId)
    .eq("class_id", classId)
    .eq("teacher_id", user.id);

  if (error) {
    console.error("[toggleEssayPublish]", error);
    redirect(
      `/dashboard/classes/${classId}?essay_error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}`);
}

export async function deleteEssay(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const essayId = readString(formData, "essay_id");
  const classId = readString(formData, "class_id");

  if (!essayId || !classId) redirect("/dashboard/classes");

  // Penjaga pengumpulan esai (perintah pemilik, 18 Nov 2026):
  // menghapus tugas esai menjalankan cascade basis data yang
  // menghapus semua esai siswa yang sudah terkumpul untuk tugas
  // itu. Hitung dulu sebelum menghapus; bila sudah ada
  // pengumpulan, batalkan dengan pesan yang jelas untuk guru.
  // Kegagalan membaca hitungan juga membatalkan penghapusan
  // (fail-closed), sama seperti penjaga deleteGame.
  const { count: submissionCount, error: countError } = await supabase
    .from("essay_submissions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", essayId);

  if (countError) {
    console.error("[deleteEssay] submission count failed:", countError);
    redirect(`/dashboard/classes/${classId}?essay_error=delete_failed`);
  }

  if ((submissionCount ?? 0) > 0) {
    redirect(
      `/dashboard/classes/${classId}?essay_error=has_submissions&essay_msg=${encodeURIComponent(
        `Sudah ada ${submissionCount} esai siswa yang terkumpul pada tugas ini.`,
      )}`,
    );
  }

  const { error } = await supabase
    .from("essay_assignments")
    .delete()
    .eq("id", essayId)
    .eq("class_id", classId)
    .eq("teacher_id", user.id);

  if (error) {
    console.error("[deleteEssay]", error);
    redirect(
      `/dashboard/classes/${classId}?essay_error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}?essay_deleted=1`);
}