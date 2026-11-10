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

// Batas impor Excel asesmen, meniru pembanding saudara di
// lib/question-bank/excel.ts (berkas maks 5 MB). Batas soal lebih longgar
// dari bank soal (140) karena satu workbook asesmen memuat beberapa
// section sekaligus (TOEFL ITP penuh saja 140 soal).
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_QUESTIONS = 500;

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
    // Rollback asesmen yang baru dibuat; kegagalan rollback tidak boleh
    // ditelan diam-diam karena akan meninggalkan asesmen yatim.
    const { error: rollbackErr } = await db
      .from("assessments")
      .delete()
      .eq("id", assessmentId);
    if (rollbackErr) {
      console.error(
        `[createAssessment] rollback gagal untuk asesmen ${assessmentId}:`,
        rollbackErr,
      );
    }
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

  const { data: deletedRows, error } = await db
    .from("assessments")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select("id");

  if (error || !deletedRows || deletedRows.length === 0) {
    redirect(
      `/dashboard/assessments?error=${encodeURIComponent(error?.message ?? "not_found")}`,
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

  const { data: updatedRows, error } = await db
    .from("assessments")
    .update({ is_published: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select("id");

  if (error || !updatedRows || updatedRows.length === 0) {
    redirect(
      `/dashboard/assessments/${id}?error=${encodeURIComponent(error?.message ?? "not_found")}`,
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
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    redirect(`/dashboard/assessments/${assessmentId}?error=file_too_large`);
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

  if (parsed.questions.length > MAX_IMPORT_QUESTIONS) {
    redirect(`/dashboard/assessments/${assessmentId}?error=too_many_questions`);
  }

  // Urutan aman: ambil dan periksa section yang ada SEBELUM menghapus
  // apa pun. Bila asesmen tidak punya section, proses berhenti di sini
  // dan soal lama tidak ikut terhapus.
  const { data: existingSections, error: sectionsErr } = await db
    .from("assessment_sections")
    .select("id, section_type, section_order")
    .eq("assessment_id", assessmentId)
    .order("section_order");

  if (sectionsErr) {
    redirect(
      `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(sectionsErr.message)}`,
    );
  }

  if (!existingSections || existingSections.length === 0) {
    redirect(`/dashboard/assessments/${assessmentId}?error=no_sections`);
  }

  // Seluruh isi workbook sudah tervalidasi parser pada titik ini; baru
  // sekarang soal lama boleh dihapus, dan error tiap penghapusan wajib
  // diperiksa supaya kegagalan tidak terlihat seperti impor berhasil.
  const { error: delQuestionsErr } = await db
    .from("assessment_questions")
    .delete()
    .eq("assessment_id", assessmentId);
  if (delQuestionsErr) {
    redirect(
      `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(delQuestionsErr.message)}`,
    );
  }
  const { error: delPassagesErr } = await db
    .from("assessment_passages")
    .delete()
    .eq("assessment_id", assessmentId);
  if (delPassagesErr) {
    redirect(
      `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(delPassagesErr.message)}`,
    );
  }
  const { error: delAudioErr } = await db
    .from("assessment_audio_groups")
    .delete()
    .eq("assessment_id", assessmentId);
  if (delAudioErr) {
    redirect(
      `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(delAudioErr.message)}`,
    );
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
    const { error: sectionUpdateErr } = await db
      .from("assessment_sections")
      .update({
        title: ps.title,
        duration_minutes: ps.duration_minutes,
        audio_play_once: ps.audio_play_once,
        allow_review: ps.allow_review,
        instructions: ps.instructions,
      })
      .eq("id", sid);
    if (sectionUpdateErr) {
      redirect(
        `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(sectionUpdateErr.message)}`,
      );
    }
  }

  const passageIdMap = new Map<string, string>();
  for (const p of parsed.passages) {
    const sid = sectionMap.get(p.section_type);
    if (!sid) continue;
    const { data: ins, error: passageErr } = await db
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
    if (passageErr) {
      redirect(
        `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(passageErr.message)}`,
      );
    }
    if (ins) passageIdMap.set(p.ref_id, (ins as { id: string }).id);
  }

  const audioIdMap = new Map<string, string>();
  for (const a of parsed.audioGroups) {
    const sid = sectionMap.get(a.section_type);
    if (!sid) continue;
    const { data: ins, error: audioErr } = await db
      .from("assessment_audio_groups")
      .insert({
        assessment_id: assessmentId,
        section_id: sid,
        group_order: a.group_order,
        title: a.title,
      })
      .select("id")
      .single();
    if (audioErr) {
      redirect(
        `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(audioErr.message)}`,
      );
    }
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

  // Hitung question_count per section dalam sekali query
  const { data: allQ } = await db
    .from("assessment_questions")
    .select("section_id")
    .eq("assessment_id", assessmentId);

  const countPerSection = new Map<string, number>();
  for (const q of (allQ ?? []) as Array<{ section_id: string }>) {
    countPerSection.set(
      q.section_id,
      (countPerSection.get(q.section_id) ?? 0) + 1,
    );
  }

  let totalQuestions = 0;
  for (const s of existingSections as Array<{ id: string }>) {
    const count = countPerSection.get(s.id) ?? 0;
    totalQuestions += count;
    const { error: countErr } = await db
      .from("assessment_sections")
      .update({ question_count: count })
      .eq("id", s.id);
    if (countErr) {
      redirect(
        `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(countErr.message)}`,
      );
    }
  }

  let totalDuration = 0;
  const { data: sectionDurations } = await db
    .from("assessment_sections")
    .select("duration_minutes")
    .eq("assessment_id", assessmentId);

  for (const s of (sectionDurations ?? []) as Array<{
    duration_minutes: number;
  }>) {
    totalDuration += s.duration_minutes ?? 0;
  }

  const { error: totalsErr } = await db
    .from("assessments")
    .update({
      total_questions: totalQuestions,
      total_duration_minutes: totalDuration,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId);
  if (totalsErr) {
    redirect(
      `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(totalsErr.message)}`,
    );
  }

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

  const { data: revoked, error: revokeErr } = await db
    .from("assessment_tokens")
    .update({ is_active: false })
    .eq("id", tokenId)
    .eq("created_by", user.id)
    .select("id");

  // Kegagalan mencabut token tidak boleh terlihat seperti berhasil:
  // token yang gagal dicabut berarti token lama masih aktif.
  if (revokeErr || !revoked || revoked.length === 0) {
    redirect(
      `/dashboard/assessments/${assessmentId}?error=${encodeURIComponent(revokeErr?.message ?? "revoke_failed")}`,
    );
  }

  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  redirect(`/dashboard/assessments/${assessmentId}`);
}

// ============================================================
// SAVE AI QUESTIONS
// ============================================================
// Perubahan (4 Okt 2026):
// - Constraint DB sekarang: UNIQUE (assessment_id, section_id, question_number)
//   sehingga nomor boleh reset per section (sesuai TOEFL ITP asli).
// - Hitung maxNum per section_id, lalu lanjutkan dari nomor terakhir.
// - Hindari loop N+1 dengan mengumpulkan section_id sekali.
// - Tambah log untuk mempermudah debug via terminal.
// ============================================================
export async function saveAIQuestions(
  fd: FormData,
): Promise<{
  ok: boolean;
  message?: string;
  savedQuestions?: number;
  savedPassages?: number;
}> {
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
      passages: Array<{
        ref_id: string;
        title: string | null;
        content: string;
      }>;
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

    // Validasi isi payload sebelum apa pun disimpan (Ma13), meniru
    // updateQuestion di question-banks/actions.ts: kunci jawaban harus
    // A-D, difficulty harus salah satu nilai yang dikenal, dan teks
    // dibatasi panjangnya. Satu soal tidak sah menolak seluruh batch.
    const questionsIn = Array.isArray(parsed.questions)
      ? parsed.questions
      : [];
    const passagesIn = Array.isArray(parsed.passages) ? parsed.passages : [];

    if (questionsIn.length > MAX_IMPORT_QUESTIONS) {
      return {
        ok: false,
        message: `Jumlah soal melebihi batas ${MAX_IMPORT_QUESTIONS}.`,
      };
    }

    for (let i = 0; i < questionsIn.length; i += 1) {
      const q = questionsIn[i];
      const label = `Soal ke-${i + 1}`;
      if (typeof q.question_text !== "string" || q.question_text.trim() === "") {
        return { ok: false, message: `${label}: teks soal kosong.` };
      }
      if (q.question_text.length > 5000) {
        return { ok: false, message: `${label}: teks soal melebihi 5000 karakter.` };
      }
      const options = [q.option_a, q.option_b, q.option_c, q.option_d];
      if (
        options.some(
          (o) => typeof o !== "string" || o.trim() === "" || o.length > 2000,
        )
      ) {
        return {
          ok: false,
          message: `${label}: semua opsi wajib diisi dan maksimal 2000 karakter.`,
        };
      }
      const answer = String(q.correct_answer ?? "").toUpperCase();
      if (!["A", "B", "C", "D"].includes(answer)) {
        return { ok: false, message: `${label}: kunci jawaban harus A, B, C, atau D.` };
      }
      q.correct_answer = answer;
      if (
        q.difficulty !== null &&
        q.difficulty !== undefined &&
        !["easy", "medium", "hard"].includes(q.difficulty)
      ) {
        return { ok: false, message: `${label}: difficulty tidak valid.` };
      }
    }

    for (let i = 0; i < passagesIn.length; i += 1) {
      const p = passagesIn[i];
      if (typeof p.content !== "string" || p.content.trim() === "") {
        return { ok: false, message: `Passage ke-${i + 1}: isi kosong.` };
      }
      if (p.content.length > 50000) {
        return { ok: false, message: `Passage ke-${i + 1}: isi melebihi 50000 karakter.` };
      }
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

    // Hitung nomor soal berikutnya per section (lanjut dari yang sudah ada).
    const { data: existingQuestions } = await db
      .from("assessment_questions")
      .select("section_id, question_number")
      .eq("assessment_id", assessmentId);

    const maxNum: Record<string, number> = {};
    for (const q of (existingQuestions ?? []) as Array<{
      section_id: string;
      question_number: number;
    }>) {
      const prev = maxNum[q.section_id] ?? 0;
      if (q.question_number > prev) maxNum[q.section_id] = q.question_number;
    }

    // Simpan passages (semua ke section "reading").
    const passageIdMap = new Map<string, string>();
    let savedPassages = 0;
    for (const p of parsed.passages ?? []) {
      const sid = sectionMap.get("reading");
      if (!sid) continue;
      const { data: ins, error: passageErr } = await db
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
      if (passageErr) {
        return {
          ok: false,
          message: `Gagal menyimpan passage: ${passageErr.message}`,
        };
      }
      if (ins) {
        passageIdMap.set(p.ref_id, (ins as { id: string }).id);
        savedPassages += 1;
      }
    }

    // Simpan questions.
    const questionRows: Array<Record<string, unknown>> = [];
    for (const q of parsed.questions ?? []) {
      const sid = sectionMap.get(q.section_type);
      if (!sid) {
        console.warn(
          `[saveAIQuestions] skip soal: section "${q.section_type}" tidak ada di assessment ini`,
        );
        continue;
      }

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
        // AI hanya menghasilkan label (misal "A1"), bukan file audio.
        // Jadi audio_group_id dibiarkan null. Kalau nanti perlu audio,
        // tinggal buat audio_groups dan isi di sini.
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
      console.error("[saveAIQuestions] insert error:", insErr.message);
      return { ok: false, message: insErr.message };
    }

    // Update question_count per section — pakai satu query lalu hitung di memory.
    const { data: allQ } = await db
      .from("assessment_questions")
      .select("section_id")
      .eq("assessment_id", assessmentId);

    const countPerSection = new Map<string, number>();
    for (const q of (allQ ?? []) as Array<{ section_id: string }>) {
      countPerSection.set(
        q.section_id,
        (countPerSection.get(q.section_id) ?? 0) + 1,
      );
    }

    for (const s of (sectionRows ?? []) as Array<{ id: string }>) {
      const count = countPerSection.get(s.id) ?? 0;
      const { error: countErr } = await db
        .from("assessment_sections")
        .update({ question_count: count })
        .eq("id", s.id);
      if (countErr) {
        return {
          ok: false,
          message: `Soal tersimpan, tetapi hitungan section gagal diperbarui: ${countErr.message}`,
        };
      }
    }

    const totalCount = (allQ ?? []).length;

    const { error: totalsErr } = await db
      .from("assessments")
      .update({
        total_questions: totalCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assessmentId);
    if (totalsErr) {
      return {
        ok: false,
        message: `Soal tersimpan, tetapi total soal gagal diperbarui: ${totalsErr.message}`,
      };
    }

    revalidatePath(`/dashboard/assessments/${assessmentId}`);

    return {
      ok: true,
      savedQuestions: questionRows.length,
      savedPassages,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    console.error("[saveAIQuestions] unexpected error:", msg);
    return { ok: false, message: msg };
  }
}