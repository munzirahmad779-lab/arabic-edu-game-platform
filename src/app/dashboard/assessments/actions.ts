"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SECTION_CONFIG,
  generateToken,
  type AssessmentType,
} from "@/lib/assessments/types";
import { parseAssessmentWorkbook } from "@/lib/assessments/parser";

const ALLOWED_TYPES: AssessmentType[] = ["toefl_itp", "toafl", "custom"];

function isAssessmentType(v: string): v is AssessmentType {
  return (ALLOWED_TYPES as string[]).includes(v);
}

export async function createAssessment(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(fd.get("title") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim();
  const typeRaw = String(fd.get("assessment_type") ?? "").trim();
  const level = String(fd.get("level") ?? "").trim();

  if (title.length < 1 || title.length > 200) {
    redirect("/dashboard/assessments?error=invalid_title");
  }
  if (!isAssessmentType(typeRaw)) {
    redirect("/dashboard/assessments?error=invalid_type");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: assessment, error: assessErr } = await db
    .from("assessments")
    .insert({
      teacher_id: user.id,
      title,
      description: description || null,
      assessment_type: typeRaw,
      level: level || null,
      is_published: false,
    })
    .select("id")
    .single();

  if (assessErr || !assessment) {
    redirect(
      `/dashboard/assessments?error=${encodeURIComponent(assessErr?.message ?? "create_failed")}`,
    );
  }

  const assessmentId = (assessment as { id: string }).id;

  const sections = DEFAULT_SECTION_CONFIG[typeRaw];
  const sectionRows = sections.map((s, idx) => ({
    assessment_id: assessmentId,
    section_order: idx + 1,
    section_type: s.section_type,
    title: s.title.id,
    instructions: null,
    duration_minutes: s.duration_minutes,
    audio_play_once: s.audio_play_once,
    allow_review: s.allow_review,
    question_count: 0,
  }));

  const { error: sectionErr } = await db
    .from("assessment_sections")
    .insert(sectionRows);

  if (sectionErr) {
    await db.from("assessments").delete().eq("id", assessmentId);
    redirect(
      `/dashboard/assessments?error=${encodeURIComponent(sectionErr.message)}`,
    );
  }

  revalidatePath("/dashboard/assessments");
  redirect(`/dashboard/assessments/${assessmentId}`);
}

export async function deleteAssessment(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(fd.get("assessment_id") ?? "");
  if (!id) redirect("/dashboard/assessments?error=invalid_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { error } = await db
    .from("assessments")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    redirect(
      `/dashboard/assessments?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/dashboard/assessments");
  redirect("/dashboard/assessments?deleted=1");
}

export async function togglePublish(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(fd.get("assessment_id") ?? "");
  const next = String(fd.get("next") ?? "true") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { error } = await db
    .from("assessments")
    .update({ is_published: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    redirect(
      `/dashboard/assessments/${id}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/assessments/${id}`);
}

export async function importAssessment(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const assessmentId = String(fd.get("assessment_id") ?? "");
  const file = fd.get("excel_file");

  if (!assessmentId) redirect("/dashboard/assessments?error=invalid_id");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/dashboard/assessments/${assessmentId}?error=no_file`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: assessment } = await db
    .from("assessments")
    .select("id")
    .eq("id", assessmentId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!assessment) redirect("/dashboard/assessments?error=not_found");

  const buffer = await file.arrayBuffer();
  let parsed;
  try {
    parsed = parseAssessmentWorkbook(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "parse_error";
    redirect(
      `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(msg)}`,
    );
  }

  if (parsed.errors.length > 0) {
    const msg = parsed.errors.slice(0, 3).join(" | ");
    redirect(
      `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(msg)}`,
    );
  }

  await db
    .from("assessment_questions")
    .delete()
    .eq("assessment_id", assessmentId);
  await db
    .from("assessment_passages")
    .delete()
    .eq("assessment_id", assessmentId);
  await db
    .from("assessment_audio_groups")
    .delete()
    .eq("assessment_id", assessmentId);

  const { data: existingSections } = await db
    .from("assessment_sections")
    .select("id, section_type, section_order")
    .eq("assessment_id", assessmentId)
    .order("section_order");

  if (!existingSections || existingSections.length === 0) {
    redirect(`/dashboard/assessments/${assessmentId}?error=no_sections`);
  }

  const sectionMap = new Map<string, string>();
  for (const s of existingSections as Array<{
    id: string;
    section_type: string;
  }>) {
    sectionMap.set(s.section_type, s.id);
  }

  for (const ps of parsed.sections) {
    const sid = sectionMap.get(ps.section_type);
    if (!sid) continue;
    await db
      .from("assessment_sections")
      .update({
        title: ps.title,
        duration_minutes: ps.duration_minutes,
        audio_play_once: ps.audio_play_once,
        allow_review: ps.allow_review,
        instructions: ps.instructions,
      })
      .eq("id", sid);
  }

  const passageIdMap = new Map<string, string>();
  for (const p of parsed.passages) {
    const sid = sectionMap.get(p.section_type);
    if (!sid) continue;
    const { data: ins } = await db
      .from("assessment_passages")
      .insert({
        assessment_id: assessmentId,
        section_id: sid,
        passage_order: p.passage_order,
        title: p.title,
        content: p.content,
      })
      .select("id")
      .single();
    if (ins) passageIdMap.set(p.ref_id, (ins as { id: string }).id);
  }

  const audioIdMap = new Map<string, string>();
  for (const a of parsed.audioGroups) {
    const sid = sectionMap.get(a.section_type);
    if (!sid) continue;
    const { data: ins } = await db
      .from("assessment_audio_groups")
      .insert({
        assessment_id: assessmentId,
        section_id: sid,
        group_order: a.group_order,
        title: a.title,
      })
      .select("id")
      .single();
    if (ins) audioIdMap.set(a.ref_id, (ins as { id: string }).id);
  }

  const questionRows = parsed.questions
    .map((q) => {
      const sid = sectionMap.get(q.section_type);
      if (!sid) return null;
      return {
        assessment_id: assessmentId,
        section_id: sid,
        question_number: q.question_number,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        passage_id: q.passage_ref
          ? passageIdMap.get(q.passage_ref) ?? null
          : null,
        audio_group_id: q.audio_ref
          ? audioIdMap.get(q.audio_ref) ?? null
          : null,
        difficulty: q.difficulty,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (questionRows.length > 0) {
    const { error: qErr } = await db
      .from("assessment_questions")
      .insert(questionRows);
    if (qErr) {
      redirect(
        `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(qErr.message)}`,
      );
    }
  }

  let totalQuestions = 0;
  let totalDuration = 0;

  for (const s of existingSections as Array<{ id: string }>) {
    const count = questionRows.filter((q) => q.section_id === s.id).length;
    totalQuestions += count;
    await db
      .from("assessment_sections")
      .update({ question_count: count })
      .eq("id", s.id);
  }

  const { data: sectionDurations } = await db
    .from("assessment_sections")
    .select("duration_minutes")
    .eq("assessment_id", assessmentId);

  for (const s of (sectionDurations ?? []) as Array<{
    duration_minutes: number;
  }>) {
    totalDuration += s.duration_minutes ?? 0;
  }

  await db
    .from("assessments")
    .update({
      total_questions: totalQuestions,
      total_duration_minutes: totalDuration,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId);

  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  redirect(`/dashboard/assessments/${assessmentId}?imported=1`);
}

export async function generateAssessmentToken(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const assessmentId = String(fd.get("assessment_id") ?? "");
  if (!assessmentId) redirect("/dashboard/assessments?error=invalid_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: assessment } = await db
    .from("assessments")
    .select("id")
    .eq("id", assessmentId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!assessment) redirect("/dashboard/assessments?error=not_found");

  let token = "";
  let success = false;
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateToken(8);
    const { error } = await db.from("assessment_tokens").insert({
      assessment_id: assessmentId,
      token: candidate,
      created_by: user.id,
      expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      max_uses: 999,
      is_active: true,
    });

    if (!error) {
      token = candidate;
      success = true;
      break;
    }
  }

  if (!success) {
    redirect(
      `/dashboard/assessments/${assessmentId}?error=token_generate_failed`,
    );
  }

  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  redirect(`/dashboard/assessments/${assessmentId}?token_created=${token}`);
}

export async function revokeToken(fd: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tokenId = String(fd.get("token_id") ?? "");
  const assessmentId = String(fd.get("assessment_id") ?? "");

  if (!tokenId || !assessmentId) {
    redirect("/dashboard/assessments?error=invalid_id");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  await db
    .from("assessment_tokens")
    .update({ is_active: false })
    .eq("id", tokenId)
    .eq("created_by", user.id);

  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  redirect(`/dashboard/assessments/${assessmentId}`);
}

// ============================================================
// SAVE AI QUESTIONS
// ============================================================
export async function saveAIQuestions(
  fd: FormData,
): Promise<{ ok: boolean; message?: string; savedQuestions?: number; savedPassages?: number }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Tidak login." };

    const assessmentId = String(fd.get("assessment_id") ?? "");
    const payloadRaw = String(fd.get("payload") ?? "");
    if (!assessmentId || !payloadRaw) {
      return { ok: false, message: "Data tidak lengkap." };
    }

    let parsed: {
      passages: Array<{ ref_id: string; title: string | null; content: string }>;
      questions: Array<{
        section_type: string;
        question_number: number;
        passage_ref: string | null;
        audio_ref: string | null;
        question_text: string;
        option_a: string;
        option_b: string;
        option_c: string;
        option_d: string;
        correct_answer: string;
        difficulty: string | null;
      }>;
    };
    try {
      parsed = JSON.parse(payloadRaw);
    } catch {
      return { ok: false, message: "Payload bukan JSON valid." };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: assessment } = await db
      .from("assessments")
      .select("id")
      .eq("id", assessmentId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (!assessment) return { ok: false, message: "Ujian tidak ditemukan." };

    const { data: sectionRows } = await db
      .from("assessment_sections")
      .select("id, section_type")
      .eq("assessment_id", assessmentId);

    const sectionMap = new Map<string, string>();
    for (const s of (sectionRows ?? []) as Array<{
      id: string;
      section_type: string;
    }>) {
      sectionMap.set(s.section_type, s.id);
    }

    // Hitung nomor soal berikutnya per section (lanjut dari yang sudah ada)
    const { data: existingQuestions } = await db
      .from("assessment_questions")
      .select("section_id, question_number")
      .eq("assessment_id", assessmentId);

    const maxNum: Record<string, number> = {};
    for (const q of (existingQuestions ?? []) as Array<{
      section_id: string;
      question_number: number;
    }>) {
      if (!maxNum[q.section_id] || q.question_number > maxNum[q.section_id]) {
        maxNum[q.section_id] = q.question_number;
      }
    }

    // Simpan passages
    const passageIdMap = new Map<string, string>();
    let savedPassages = 0;
    for (const p of parsed.passages ?? []) {
      const sid = sectionMap.get("reading");
      if (!sid) continue;
      const { data: ins } = await db
        .from("assessment_passages")
        .insert({
          assessment_id: assessmentId,
          section_id: sid,
          passage_order: 1,
          title: p.title,
          content: p.content,
        })
        .select("id")
        .single();
      if (ins) {
        passageIdMap.set(p.ref_id, (ins as { id: string }).id);
        savedPassages += 1;
      }
    }

    // Simpan questions
    const questionRows: Array<Record<string, unknown>> = [];
    for (const q of parsed.questions ?? []) {
      const sid = sectionMap.get(q.section_type);
      if (!sid) continue;

      const nextNum = (maxNum[sid] ?? 0) + 1;
      maxNum[sid] = nextNum;

      questionRows.push({
        assessment_id: assessmentId,
        section_id: sid,
        question_number: nextNum,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        passage_id: q.passage_ref
          ? passageIdMap.get(q.passage_ref) ?? null
          : null,
        audio_group_id: null,
        difficulty: q.difficulty,
      });
    }

    if (questionRows.length === 0) {
      return { ok: false, message: "Tidak ada soal untuk disimpan." };
    }

    const { error: insErr } = await db
      .from("assessment_questions")
      .insert(questionRows);
    if (insErr) {
      return { ok: false, message: insErr.message };
    }

    // Update question_count per section + total
    for (const s of (sectionRows ?? []) as Array<{ id: string }>) {
      const { count } = await db
        .from("assessment_questions")
        .select("id", { count: "exact", head: true })
        .eq("assessment_id", assessmentId)
        .eq("section_id", s.id);
      await db
        .from("assessment_sections")
        .update({ question_count: count ?? 0 })
        .eq("id", s.id);
    }

    const { count: totalCount } = await db
      .from("assessment_questions")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessmentId);

    await db
      .from("assessments")
      .update({
        total_questions: totalCount ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assessmentId);

    revalidatePath(`/dashboard/assessments/${assessmentId}`);

    return {
      ok: true,
      savedQuestions: questionRows.length,
      savedPassages,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Gagal menyimpan.",
    };
  }
}