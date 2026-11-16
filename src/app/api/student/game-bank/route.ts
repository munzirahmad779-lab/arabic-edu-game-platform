import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStudentSession, getStudentToken } from "@/lib/student-auth";
import { mapBankQuestions } from "@/lib/game-bank-feed-core";

/**
 * Umpan Bank Soal LMS untuk permainan solo versi siswa.
 * Bentuk respons sama persis dengan /api/game-bank milik guru, supaya
 * LmsBankPicker yang sama bisa memakainya (lewat prop apiBase).
 * Bedanya sumber kewenangan: sesi siswa (nama+PIN) dan bank yang
 * terlihat hanya bank milik guru pemilik kelas siswa itu, diselesaikan
 * di basis data oleh RPC student_list_class_banks /
 * student_get_class_bank (migrasi 0116). Jalur guru tidak berubah.
 * GET tanpa parameter: daftar bank kelas. GET ?bankId=<uuid>: soal
 * bank itu dalam bentuk netral. Tanpa sesi siswa valid: 401.
 */
export async function GET(request: Request) {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const token = await getStudentToken();
  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = await createClient();
  const bankId = new URL(request.url).searchParams.get("bankId");

  if (!bankId) {
    const { data, error } = await supabase.rpc("student_list_class_banks", {
      p_token: token,
    });
    if (error) {
      console.error("[api/student/game-bank]", error);
      return NextResponse.json({ banks: [] });
    }
    const banks = (data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      questionCount: b.question_count,
    }));
    return NextResponse.json({ banks });
  }

  const { data, error } = await supabase.rpc("student_get_class_bank", {
    p_token: token,
    p_bank_id: bankId,
  });
  if (error) {
    console.error("[api/student/game-bank]", error);
    return NextResponse.json({ error: "BANK_NOT_FOUND" }, { status: 404 });
  }
  if (!data) {
    return NextResponse.json({ error: "BANK_NOT_FOUND" }, { status: 404 });
  }

  const raw = data as {
    questions?: Array<{
      id: string;
      question_text: string | null;
      correct_option_key: string | null;
    }>;
    options?: Array<{
      question_id: string;
      option_key: string;
      option_text: string;
    }>;
  };
  const questions = mapBankQuestions(raw.questions ?? [], raw.options ?? []);
  return NextResponse.json({ questions });
}
