"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { QuestionImportRow } from "@/lib/question-bank/excel";

const MAX_BANK_NAME_LENGTH = 100;
const MAX_BANK_DESCRIPTION_LENGTH = 500;
const MAX_CATEGORY_NAME_LENGTH = 100;

function redirectCategoryError(code: string): never {
  redirect(`/dashboard/question-banks?category_error=${code}`);
}

export async function createQuestionCategory(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (!name || name.length > MAX_CATEGORY_NAME_LENGTH) {
    redirectCategoryError("invalid");
  }

  const { error } = await supabase.from("question_categories").insert({
    teacher_id: user.id,
    name,
  });

  if (error) {
    if (error.code === "23505") redirectCategoryError("duplicate");
    redirectCategoryError("create_failed");
  }

  revalidatePath("/dashboard/question-banks");
  redirect("/dashboard/question-banks");
}

export async function updateQuestionCategory(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rawId = formData.get("id");
  const rawName = formData.get("name");
  const id = typeof rawId === "string" ? rawId.trim() : "";
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (!/^[0-9a-f-]{36}$/i.test(id) || !name || name.length > MAX_CATEGORY_NAME_LENGTH) {
    redirectCategoryError("invalid");
  }

  const { error } = await supabase
    .from("question_categories")
    .update({ name })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    if (error.code === "23505") redirectCategoryError("duplicate");
    redirectCategoryError("update_failed");
  }

  revalidatePath("/dashboard/question-banks");
  redirect("/dashboard/question-banks");
}

export async function deleteQuestionCategory(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId.trim() : "";

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirectCategoryError("invalid");
  }

  const { count, error: countError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", user.id)
    .eq("category_id", id)
    .not("question_bank_id", "is", null);

  if (countError) redirectCategoryError("delete_failed");
  if ((count ?? 0) > 0) redirectCategoryError("in_use");

  const { error } = await supabase
    .from("question_categories")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) redirectCategoryError("delete_failed");

  revalidatePath("/dashboard/question-banks");
  redirect("/dashboard/question-banks");
}

export async function createQuestionBank(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rawName = formData.get("name");
  const rawDescription = formData.get("description");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";

  if (!name || name.length > MAX_BANK_NAME_LENGTH || description.length > MAX_BANK_DESCRIPTION_LENGTH) {
    redirect("/dashboard/question-banks?error=invalid_bank");
  }

  const { error } = await supabase.from("question_banks").insert({
    teacher_id: user.id,
    name,
    description: description || null,
  });

  if (error) {
    if (error.code === "23505") redirect("/dashboard/question-banks?error=duplicate_bank");
    redirect("/dashboard/question-banks?error=create_bank_failed");
  }

  revalidatePath("/dashboard/question-banks");
  revalidatePath("/dashboard");
  redirect("/dashboard/question-banks");
}

export async function importQuestionBankRows(questionBankId: string, rows: QuestionImportRow[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, message: "Sesi guru tidak ditemukan. Silakan masuk kembali." };
  }

  if (!/^[0-9a-f-]{36}$/i.test(questionBankId)) {
    return { ok: false as const, message: "Buku soal tidak valid." };
  }

  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 40) {
    return { ok: false as const, message: "Import harus berisi 1–40 soal." };
  }

  const { data, error } = await supabase.rpc("import_question_bank_rows", {
    p_question_bank_id: questionBankId,
    p_rows: rows,
  });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  revalidatePath("/dashboard/question-banks");
  return { ok: true as const, imported: Number(data) };
}


const QUESTION_ID_RE = /^[0-9a-f-]{36}$/i;
const OPTION_KEYS = ["A", "B", "C", "D"] as const;
type OptionKey = (typeof OPTION_KEYS)[number];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateQuestion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, message: "Sesi guru tidak ditemukan. Silakan masuk kembali." };
  }

  const questionId = readString(formData, "question_id");
  const categoryId = readString(formData, "category_id");
  const questionText = readString(formData, "question_text");
  const correctOptionKey = readString(formData, "correct_option_key") as OptionKey;
  const difficulty = readString(formData, "difficulty") as Difficulty;

  const options = Object.fromEntries(
    OPTION_KEYS.map((key) => [key, readString(formData, `option_${key}`)]),
  ) as Record<OptionKey, string>;

  if (!QUESTION_ID_RE.test(questionId)) {
    return { ok: false as const, message: "ID soal tidak valid." };
  }
  if (!QUESTION_ID_RE.test(categoryId)) {
    return { ok: false as const, message: "Topik tidak valid." };
  }
  if (!questionText || questionText.length > 5000) {
    return { ok: false as const, message: "Pertanyaan wajib diisi dan maksimal 5000 karakter." };
  }
  if (!OPTION_KEYS.includes(correctOptionKey)) {
    return { ok: false as const, message: "Jawaban benar harus A, B, C, atau D." };
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    return { ok: false as const, message: "Tingkat kesulitan tidak valid." };
  }
  if (OPTION_KEYS.some((key) => !options[key] || options[key].length > 2000)) {
    return { ok: false as const, message: "Semua pilihan A–D wajib diisi dan maksimal 2000 karakter." };
  }

  const { data, error } = await supabase.rpc("update_question_bank_question", {
    p_question_id: questionId,
    p_category_id: categoryId,
    p_question_text: questionText,
    p_difficulty: difficulty,
    p_correct_option_key: correctOptionKey,
    p_options: options,
  });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  if (data !== true) {
    return { ok: false as const, message: "Soal tidak dapat diperbarui." };
  }

  revalidatePath("/dashboard/question-banks");
  return { ok: true as const };
}

export async function deleteQuestion(questionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, message: "Sesi guru tidak ditemukan. Silakan masuk kembali." };
  }

  if (!QUESTION_ID_RE.test(questionId)) {
    return { ok: false as const, message: "ID soal tidak valid." };
  }

  const { data, error } = await supabase.rpc("delete_question_bank_question", {
    p_question_id: questionId,
  });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  if (data !== true) {
    return { ok: false as const, message: "Soal tidak dapat dihapus." };
  }

  revalidatePath("/dashboard/question-banks");
  return { ok: true as const };
}
