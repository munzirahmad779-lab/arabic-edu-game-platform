import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  createQuestionBank,
  createQuestionCategory,
  deleteQuestionCategory,
  updateQuestionCategory,
} from "./actions";
import { QuestionBankImportForm } from "./import-form";
import { QuestionMediaManager } from "./media-manager";
import { QuestionEditor } from "./question-editor";
import { DeleteBankForm } from "./delete-bank-form";
import { BankCard } from "./bank-card";
import { AiPromptSection } from "./ai-prompt-section";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SearchParams = {
  error?: string;
  category_error?: string;
  deleted?: string;
  bank?: string;
  cat?: string;
};

type QuestionRow = {
  id: string;
  question_bank_id: string | null;
  question_text: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  correct_option_key: "A" | "B" | "C" | "D" | null;
  category_id: string | null;
};

type OptionRow = {
  question_id: string;
  option_key: "A" | "B" | "C" | "D";
  option_text: string;
};

type MediaRow = {
  id: string;
  question_id: string;
  media_type: "audio" | "image" | "video";
  expected_filename: string;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  max_play_count: number | null;
  attached_at: string | null;
};

function isValidUuid(v: string | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
}

export default async function QuestionBanksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";

  const L = {
    page_title: isRtl
      ? "بنك الأسئلة"
      : locale === "en"
        ? "Question Banks"
        : "Bank Soal",
    page_sub: isRtl
      ? "إنشاء بنك أسئلة واستيراد أسئلة MCQ من قالب Excel الرسمي."
      : locale === "en"
        ? "Create question banks and import MCQ questions from the official Excel template."
        : "Buat bank soal dan impor soal MCQ dari template Excel resmi.",
    dashboard: isRtl ? "لوحة التحكم" : "Dashboard",
    deleted_ok: isRtl
      ? "✓ تم حذف بنك الأسئلة بنجاح."
      : locale === "en"
        ? "✓ Question bank deleted."
        : "✓ Bank soal berhasil dihapus.",
    err_invalid_bank: isRtl
      ? "Nama atau deskripsi buku soal tidak valid."
      : locale === "en"
        ? "Question bank name or description is invalid."
        : "Nama atau deskripsi bank soal tidak valid.",
    err_dup_bank: isRtl
      ? "Buku soal dengan nama tersebut sudah ada."
      : locale === "en"
        ? "A question bank with that name already exists."
        : "Bank soal dengan nama itu sudah ada.",
    err_create_bank: isRtl
      ? "Buku soal gagal dibuat."
      : locale === "en"
        ? "Failed to create question bank."
        : "Gagal membuat bank soal.",
    err_invalid_bank_id: isRtl
      ? "معرف البنك غير صالح."
      : locale === "en"
        ? "Invalid bank ID."
        : "ID bank tidak valid.",
    cat_invalid: isRtl
      ? "Nama topik tidak valid. Gunakan 1–100 karakter."
      : locale === "en"
        ? "Invalid topic name. Use 1–100 characters."
        : "Nama topik tidak valid. Gunakan 1–100 karakter.",
    cat_dup: isRtl
      ? "Topik dengan nama tersebut sudah ada."
      : locale === "en"
        ? "A topic with that name already exists."
        : "Topik dengan nama itu sudah ada.",
    cat_create_failed: isRtl
      ? "Topik gagal dibuat."
      : locale === "en"
        ? "Failed to create topic."
        : "Gagal membuat topik.",
    cat_update_failed: isRtl
      ? "Topik gagal diperbarui."
      : locale === "en"
        ? "Failed to update topic."
        : "Gagal memperbarui topik.",
    cat_delete_failed: isRtl
      ? "Topik gagal dihapus."
      : locale === "en"
        ? "Failed to delete topic."
        : "Gagal menghapus topik.",
    cat_in_use: isRtl
      ? "Topik tidak dapat dihapus selama masih dipakai oleh soal di Bank Soal."
      : locale === "en"
        ? "Topic cannot be deleted while still used by questions in the bank."
        : "Topik tidak bisa dihapus selama masih dipakai oleh soal di bank.",
    topics_title: isRtl
      ? "موضوعات الأسئلة"
      : locale === "en"
        ? "Question Topics"
        : "Topik Soal",
    topics_desc: isRtl
      ? "أنشئ الموضوعات التي ستستخدم أسماءها في عمود «Topik» داخل قالب Excel."
      : locale === "en"
        ? "Create topics whose names you will use in the «Topik» column inside the Excel template."
        : "Buat topik yang namanya akan kamu pakai di kolom «Topik» dalam template Excel.",
    topics_count: isRtl
      ? "موضوع"
      : locale === "en"
        ? "topics"
        : "topik",
    add_topic: isRtl ? "إضافة موضوع" : locale === "en" ? "Add Topic" : "Tambah Topik",
    save: isRtl ? "حفظ" : locale === "en" ? "Save" : "Simpan",
    delete: isRtl ? "حذف" : locale === "en" ? "Delete" : "Hapus",
    no_topics: isRtl
      ? "لا توجد موضوعات بعد. أنشئ موضوعًا أولًا قبل استيراد الأسئلة."
      : locale === "en"
        ? "No topics yet. Create a topic before importing questions."
        : "Belum ada topik. Buat topik dulu sebelum impor soal.",
    excel_title: isRtl
      ? "قالب Excel الرسمي"
      : locale === "en"
        ? "Official Excel Template"
        : "Template Excel Resmi",
    excel_desc: isRtl
      ? "القالب يحتوي على 140 صفًا جاهزًا للإدخال ولا يحتوي على أسئلة حقيقية."
      : locale === "en"
        ? "The template contains 140 ready rows and no real questions."
        : "Template berisi 140 baris siap isi dan tidak ada soal asli.",
    excel_download: isRtl
      ? "تنزيل القالب"
      : locale === "en"
        ? "Download Template"
        : "Unduh Template",
    create_bank_title: isRtl
      ? "إنشاء بنك جديد"
      : locale === "en"
        ? "Create New Bank"
        : "Buat Bank Baru",
    name_placeholder: isRtl
      ? "مثال: النحو الأساسي"
      : locale === "en"
        ? "Example: Basic Grammar"
        : "Contoh: Nahwu Dasar",
    desc_placeholder: isRtl
      ? "وصف اختياري"
      : locale === "en"
        ? "Optional description"
        : "Deskripsi opsional",
    create_bank_btn: isRtl
      ? "إنشاء بنك الأسئلة"
      : locale === "en"
        ? "Create Question Bank"
        : "Buat Bank Soal",
    my_banks: isRtl ? "بنكي" : locale === "en" ? "My Banks" : "Bank Saya",
    banks_count: isRtl ? "بنك" : locale === "en" ? "banks" : "bank",
    no_banks: isRtl
      ? "لم تنشئ بنك أسئلة بعد."
      : locale === "en"
        ? "You haven't created any question banks yet."
        : "Kamu belum membuat bank soal.",
    all: isRtl ? "الكل" : locale === "en" ? "All" : "Semua",
    no_topic: isRtl ? "بدون موضوع" : locale === "en" ? "No topic" : "Tanpa topik",
    questions_saved: isRtl
      ? "الأسئلة المحفوظة"
      : locale === "en"
        ? "Saved Questions"
        : "Soal Tersimpan",
    questions_unit: isRtl ? "سؤال" : locale === "en" ? "questions" : "soal",
    no_q_in_bank: isRtl
      ? "لا توجد أسئلة محفوظة في هذا البنك."
      : locale === "en"
        ? "No saved questions in this bank."
        : "Belum ada soal di bank ini.",
    no_q_filter: isRtl
      ? "لا توجد أسئلة تطابق الفلتر المحدد."
      : locale === "en"
        ? "No questions match the selected filter."
        : "Tidak ada soal yang cocok dengan filter.",
    correct: isRtl
      ? "الإجابة الصحيحة"
      : locale === "en"
        ? "Correct Answer"
        : "Jawaban Benar",
    option_missing: isRtl
      ? "الخيار غير موجود"
      : locale === "en"
        ? "Option not found"
        : "Opsi tidak ditemukan",
    import_title: isRtl
      ? "استيراد الأسئلة من Excel"
      : locale === "en"
        ? "Import Questions from Excel"
        : "Impor Soal dari Excel",
    import_desc: isRtl
      ? "تتم مراجعة الملف أولًا. لا يتم حفظ أي سؤال إذا وُجد خطأ واحد."
      : locale === "en"
        ? "The file is reviewed first. No questions saved if any error found."
        : "File direview dulu. Tidak ada soal tersimpan jika ada 1 error.",
    import_note: isRtl
      ? "تُنشئ قيمة «YA» في ملف Excel سجلًا لوسائط متوقعة فقط."
      : locale === "en"
        ? "The «YA» value in Excel creates an expected media record only."
        : "Nilai «YA» di Excel hanya membuat catatan media yang diharapkan.",
    delete_bank_warn: isRtl
      ? "⚠️ حذف البنك سيحذف جميع الأسئلة داخله."
      : locale === "en"
        ? "⚠️ Deleting the bank will delete all questions inside."
        : "⚠️ Menghapus bank akan menghapus semua soal di dalamnya.",
    difficulty_easy: isRtl ? "Mudah" : locale === "en" ? "Easy" : "Mudah",
    difficulty_medium: isRtl ? "Sedang" : locale === "en" ? "Medium" : "Sedang",
    difficulty_hard: isRtl ? "Sulit" : locale === "en" ? "Hard" : "Sulit",
  };

  const errorMessage = (() => {
    switch (searchParams.error) {
      case "invalid_bank": return L.err_invalid_bank;
      case "duplicate_bank": return L.err_dup_bank;
      case "create_bank_failed": return L.err_create_bank;
      case "invalid_bank_id": return L.err_invalid_bank_id;
      default:
        return searchParams.error ? `${dict.common.error}: ${searchParams.error}` : null;
    }
  })();

  const categoryErrorMessage = (() => {
    switch (searchParams.category_error) {
      case "invalid": return L.cat_invalid;
      case "duplicate": return L.cat_dup;
      case "create_failed": return L.cat_create_failed;
      case "update_failed": return L.cat_update_failed;
      case "delete_failed": return L.cat_delete_failed;
      case "in_use": return L.cat_in_use;
      default: return null;
    }
  })();

  const difficultyLabel: Record<
    NonNullable<QuestionRow["difficulty"]>,
    string
  > = {
    easy: L.difficulty_easy,
    medium: L.difficulty_medium,
    hard: L.difficulty_hard,
  };

  const [
    { data: banks, error: banksError },
    { data: categories, error: categoriesError },
    { data: questions, error: questionsError },
  ] = await Promise.all([
    supabase
      .from("question_banks")
      .select("id, name, description, created_at, updated_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("question_categories")
      .select("id, name, created_at, updated_at")
      .eq("teacher_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("questions")
      .select(
        "id, question_bank_id, question_text, difficulty, correct_option_key, category_id",
      )
      .eq("teacher_id", user.id)
      .not("question_bank_id", "is", null)
      .order("created_at", { ascending: true }),
  ]);

  if (banksError) throw new Error("Gagal memuat bank soal.");
  if (categoriesError) throw new Error("Gagal memuat topik soal.");
  if (questionsError) throw new Error("Gagal memuat soal.");

  const questionRows = (questions ?? []) as QuestionRow[];
  const questionIds = questionRows.map((q) => q.id);

  let options: OptionRow[] = [];
  let media: MediaRow[] = [];
  if (questionIds.length > 0) {
    const [
      { data: optionData, error: optionsError },
      { data: mediaData, error: mediaError },
    ] = await Promise.all([
      supabase
        .from("question_options")
        .select("question_id, option_key, option_text")
        .in("question_id", questionIds)
        .order("option_key", { ascending: true }),
      supabase
        .from("question_media")
        .select(
          "id, question_id, media_type, expected_filename, storage_path, original_filename, mime_type, size_bytes, max_play_count, attached_at",
        )
        .in("question_id", questionIds)
        .order("created_at", { ascending: true }),
    ]);
    if (optionsError) throw new Error("Gagal memuat pilihan jawaban.");
    if (mediaError) throw new Error("Gagal memuat media soal.");
    options = (optionData ?? []) as OptionRow[];
    media = (mediaData ?? []) as MediaRow[];
  }

  const categoryMap = new Map(
    (categories ?? []).map((c) => [c.id, c.name]),
  );

  const optionsByQuestion = new Map<string, OptionRow[]>();
  for (const option of options) {
    const current = optionsByQuestion.get(option.question_id) ?? [];
    current.push(option);
    optionsByQuestion.set(option.question_id, current);
  }

  const mediaByQuestion = new Map<string, MediaRow[]>();
  for (const item of media) {
    const current = mediaByQuestion.get(item.question_id) ?? [];
    current.push(item);
    mediaByQuestion.set(item.question_id, current);
  }

  const questionsByBank = new Map<string, QuestionRow[]>();
  for (const question of questionRows) {
    if (!question.question_bank_id) continue;
    const current = questionsByBank.get(question.question_bank_id) ?? [];
    current.push(question);
    questionsByBank.set(question.question_bank_id, current);
  }

  return (
    <div className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{L.page_title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{L.page_sub}</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
        >
          {L.dashboard}
        </Link>
      </div>

      {searchParams.deleted === "1" ? (
        <div
          role="alert"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {L.deleted_ok}
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      ) : null}

      {categoryErrorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {categoryErrorMessage}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{L.my_banks}</h2>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">
            {banks?.length ?? 0} {L.banks_count}
          </span>
        </div>

        {!banks || banks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            {L.no_banks}
          </div>
        ) : (
          banks.map((bank) => {
            const bankQuestions = questionsByBank.get(bank.id) ?? [];
            const isFilterActive = searchParams.bank === bank.id;
            const activeCat = (() => {
              if (!isFilterActive) return undefined;
              const c = searchParams.cat;
              if (!c) return undefined;
              if (c === "__none__") return c;
              if (isValidUuid(c)) return c;
              return undefined;
            })();

            const filteredBankQuestions = activeCat
              ? activeCat === "__none__"
                ? bankQuestions.filter((q) => !q.category_id)
                : bankQuestions.filter((q) => q.category_id === activeCat)
              : bankQuestions;

            const header = (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-neutral-900">
                    {bank.name}
                  </h3>
                  {bank.description ? (
                    <p className="mt-0.5 truncate text-sm text-neutral-500">
                      {bank.description}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                  {bankQuestions.length} {L.questions_unit}
                </span>
              </div>
            );

            return (
              <BankCard
                key={bank.id}
                bankId={bank.id}
                header={header}
                defaultOpen={isFilterActive}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/40 p-3">
                  <div className="text-xs text-red-700">{L.delete_bank_warn}</div>
                  <DeleteBankForm
                    bankId={bank.id}
                    bankName={bank.name}
                    questionCount={bankQuestions.length}
                  />
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <h4 className="font-semibold">{L.import_title}</h4>
                  <p className="mt-1 mb-3 text-sm text-neutral-600">
                    {L.import_desc}
                  </p>
                  <p className="mb-3 rounded-md bg-blue-50 p-3 text-xs text-blue-900">
                    {L.import_note}
                  </p>
                  <QuestionBankImportForm questionBankId={bank.id} />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-semibold">{L.questions_saved}</h4>
                    <span className="text-sm text-neutral-500">
                      {filteredBankQuestions.length} / {bankQuestions.length}{" "}
                      {L.questions_unit}
                    </span>
                  </div>

                  {bankQuestions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/question-banks?bank=${bank.id}`}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                          isFilterActive && !activeCat
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {L.all} ({bankQuestions.length})
                      </Link>

                      {(categories ?? []).map((cat) => {
                        const count = bankQuestions.filter(
                          (q) => q.category_id === cat.id,
                        ).length;
                        if (count === 0) return null;
                        const isActive = isFilterActive && activeCat === cat.id;
                        return (
                          <Link
                            key={cat.id}
                            href={`/dashboard/question-banks?bank=${bank.id}&cat=${cat.id}`}
                            className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                              isActive
                                ? "border-violet-600 bg-violet-600 text-white"
                                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                            }`}
                          >
                            {cat.name} ({count})
                          </Link>
                        );
                      })}

                      {(() => {
                        const noneCount = bankQuestions.filter(
                          (q) => !q.category_id,
                        ).length;
                        if (noneCount === 0) return null;
                        const isActive =
                          isFilterActive && activeCat === "__none__";
                        return (
                          <Link
                            href={`/dashboard/question-banks?bank=${bank.id}&cat=__none__`}
                            className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                              isActive
                                ? "border-amber-600 bg-amber-600 text-white"
                                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                            }`}
                          >
                            {L.no_topic} ({noneCount})
                          </Link>
                        );
                      })()}
                    </div>
                  ) : null}

                  {filteredBankQuestions.length === 0 ? (
                    <div className="mt-4 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center text-sm text-neutral-500">
                      {bankQuestions.length === 0 ? L.no_q_in_bank : L.no_q_filter}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {filteredBankQuestions.map((question, index) => {
                        const questionOptions =
                          optionsByQuestion.get(question.id) ?? [];

                        return (
                          <article
                            key={question.id}
                            className="rounded-lg border border-neutral-200 p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                              <span>
                                {locale === "ar" ? "السؤال" : "Soal"} {index + 1}
                              </span>
                              {question.category_id ? (
                                <span className="rounded-full bg-neutral-100 px-2 py-1">
                                  {categoryMap.get(question.category_id) ??
                                    "—"}
                                </span>
                              ) : null}
                              {question.difficulty ? (
                                <span className="rounded-full bg-neutral-100 px-2 py-1">
                                  {difficultyLabel[question.difficulty]}
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-3 text-base font-medium leading-8">
                              {question.question_text ?? "—"}
                            </p>

                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              {(["A", "B", "C", "D"] as const).map((key) => {
                                const option = questionOptions.find(
                                  (item) => item.option_key === key,
                                );
                                const isCorrect =
                                  question.correct_option_key === key;

                                return (
                                  <div
                                    key={key}
                                    className={`rounded-md border p-3 ${
                                      isCorrect
                                        ? "border-green-300 bg-green-50 text-green-900"
                                        : "border-neutral-200 bg-white"
                                    }`}
                                  >
                                    <span className="font-semibold">
                                      {key}.
                                    </span>{" "}
                                    {option?.option_text ?? L.option_missing}
                                    {isCorrect ? (
                                      <span className="mr-2 text-xs font-semibold">
                                        ✓ {L.correct}
                                      </span>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>

                            <QuestionMediaManager
                              questionId={question.id}
                              media={mediaByQuestion.get(question.id) ?? []}
                            />
                            <QuestionEditor
                              question={{
                                id: question.id,
                                category_id: question.category_id,
                                question_text: question.question_text,
                                difficulty: question.difficulty,
                                correct_option_key:
                                  question.correct_option_key,
                              }}
                              options={questionOptions.map((option) => ({
                                option_key: option.option_key,
                                option_text: option.option_text,
                              }))}
                              categories={(categories ?? []).map((category) => ({
                                id: category.id,
                                name: category.name,
                              }))}
                              mediaCount={
                                (mediaByQuestion.get(question.id) ?? []).length
                              }
                            />
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </BankCard>
            );
          })
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{L.create_bank_title}</h2>
        <form action={createQuestionBank} className="mt-4 grid gap-3">
          <input
            name="name"
            required
            maxLength={100}
            placeholder={L.name_placeholder}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            maxLength={500}
            placeholder={L.desc_placeholder}
            rows={3}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {L.create_bank_btn}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{L.topics_title}</h2>
            <p className="mt-1 text-sm text-neutral-600">{L.topics_desc}</p>
          </div>
          <span className="text-sm text-neutral-500">
            {categories?.length ?? 0} {L.topics_count}
          </span>
        </div>

        <form
          action={createQuestionCategory}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="category-name" className="sr-only">
            {L.topics_title}
          </label>
          <input
            id="category-name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder={L.name_placeholder}
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {L.add_topic}
          </button>
        </form>

        {categories && categories.length > 0 ? (
          <div className="mt-5 space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="rounded-md border border-neutral-200 p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <form
                    action={updateQuestionCategory}
                    className="flex min-w-0 flex-1 gap-2"
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <label
                      htmlFor={`category-${category.id}`}
                      className="sr-only"
                    >
                      {L.topics_title}
                    </label>
                    <input
                      id={`category-${category.id}`}
                      name="name"
                      defaultValue={category.name}
                      required
                      maxLength={100}
                      className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
                    >
                      {L.save}
                    </button>
                  </form>
                  <form action={deleteQuestionCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      {L.delete}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center text-sm text-neutral-500">
            {L.no_topics}
          </div>
        )}
      </section>

      <AiPromptSection />

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{L.excel_title}</h2>
            <p className="mt-1 text-sm text-neutral-600">{L.excel_desc}</p>
          </div>
          <a
            href="/templates/question-bank-template.xlsx"
            download
            className="w-fit rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            {L.excel_download}
          </a>
        </div>
      </section>
    </div>
  );
}