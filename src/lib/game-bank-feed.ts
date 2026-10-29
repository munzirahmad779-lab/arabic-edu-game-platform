import { createClient } from "@/lib/supabase/server";

/**
 * Umpan Bank Soal LMS untuk game mandiri (hot-seat) di /game/*.
 *
 * Game mandiri (Sigetteng, Basket, Tarik, Fruit, Space War) awalnya hanya
 * membawa bank lokal di perangkat guru. Modul ini membaca bank milik guru
 * yang sedang login dari Bank Soal LMS (tabel question_banks, questions,
 * question_options, semua terikat teacher_id + RLS) dan memetakannya ke
 * bentuk netral yang bisa diadaptasi tiap game ke tipe soalnya sendiri.
 *
 * Hanya soal pilihan ganda teks yang diteruskan: pertanyaan wajib punya
 * teks, kunci jawaban, dan tepat 4 opsi teks terurut A-D, karena semua
 * game mandiri mengharapkan format itu. Soal lain dilewati, bukan ditebak.
 */

import type { LmsBankSummary, LmsQuestion } from "./game-bank-feed-core";
import { mapBankQuestions } from "./game-bank-feed-core";

export type { LmsBankSummary, LmsQuestion };

/** Daftar bank milik guru + jumlah soal yang bisa dipakai game. */
export async function listTeacherBanksForGames(
  teacherId: string,
): Promise<LmsBankSummary[]> {
  const supabase = await createClient();
  const { data: banks, error } = await supabase
    .from("question_banks")
    .select("id, name")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error || !banks) return [];

  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_bank_id, question_text, correct_option_key")
    .eq("teacher_id", teacherId)
    .not("question_bank_id", "is", null);

  const counts = new Map<string, number>();
  for (const q of questions ?? []) {
    if (!q.question_bank_id) continue;
    if (!(q.question_text ?? "").trim()) continue;
    if (!(q.correct_option_key ?? "").trim()) continue;
    counts.set(q.question_bank_id, (counts.get(q.question_bank_id) ?? 0) + 1);
  }

  return banks.map((b) => ({
    id: b.id,
    name: b.name,
    questionCount: counts.get(b.id) ?? 0,
  }));
}

/** Soal satu bank dalam bentuk netral; null bila bank bukan milik guru. */
export async function getBankQuestionsForGame(
  teacherId: string,
  bankId: string,
): Promise<LmsQuestion[] | null> {
  const supabase = await createClient();
  const { data: bank, error } = await supabase
    .from("question_banks")
    .select("id")
    .eq("id", bankId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error || !bank) return null;

  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, correct_option_key")
    .eq("teacher_id", teacherId)
    .eq("question_bank_id", bankId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (!questions || questions.length === 0) return [];

  const { data: options } = await supabase
    .from("question_options")
    .select("question_id, option_key, option_text")
    .in(
      "question_id",
      questions.map((q) => q.id),
    )
    .order("option_key", { ascending: true });

  return mapBankQuestions(questions, options ?? []);
}
