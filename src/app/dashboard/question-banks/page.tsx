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

type SearchParams = {
  error?: string;
  category_error?: string;
  deleted?: string;
  bank?: string;
  cat?: string;
};

function errorMessage(error?: string) {
  switch (error) {
    case "invalid_bank":
      return "Nama atau deskripsi buku soal tidak valid.";
    case "duplicate_bank":
      return "Buku soal dengan nama tersebut sudah ada.";
    case "create_bank_failed":
      return "Buku soal gagal dibuat.";
    case "invalid_bank_id":
      return "معرف البنك غير صالح.";
    default:
      return error ? `خطأ: ${error}` : null;
  }
}

function categoryErrorMessage(error?: string) {
  switch (error) {
    case "invalid":
      return "Nama topik tidak valid. Gunakan 1–100 karakter.";
    case "duplicate":
      return "Topik dengan nama tersebut sudah ada.";
    case "create_failed":
      return "Topik gagal dibuat.";
    case "update_failed":
      return "Topik gagal diperbarui.";
    case "delete_failed":
      return "Topik gagal dihapus.";
    case "in_use":
      return "Topik tidak dapat dihapus selama masih dipakai oleh soal di Bank Soal.";
    default:
      return null;
  }
}

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

const difficultyLabel: Record<NonNullable<QuestionRow["difficulty"]>, string> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
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

  if (banksError) {
    throw new Error("Gagal memuat buku soal.");
  }
  if (categoriesError) {
    throw new Error("Gagal memuat topik soal.");
  }
  if (questionsError) {
    throw new Error("Gagal memuat soal.");
  }

  const questionRows = (questions ?? []) as QuestionRow[];
  const questionIds = questionRows.map((question) => question.id);

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

    if (optionsError) {
      throw new Error("Gagal memuat pilihan jawaban.");
    }
    if (mediaError) throw new Error("Gagal memuat media soal.");

    options = (optionData ?? []) as OptionRow[];
    media = (mediaData ?? []) as MediaRow[];
  }

  const categoryMap = new Map(
    (categories ?? []).map((category) => [category.id, category.name]),
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
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">بنك الأسئلة</h1>
          <p className="mt-1 text-sm text-neutral-600">
            إنشاء بنك أسئلة واستيراد أسئلة MCQ من قالب Excel الرسمي.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
        >
          لوحة التحكم
        </Link>
      </div>

      {searchParams.deleted === "1" ? (
        <div
          role="alert"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          ✓ تم حذف بنك الأسئلة بنجاح.
        </div>
      ) : null}

      {errorMessage(searchParams.error) ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage(searchParams.error)}
        </div>
      ) : null}

      {categoryErrorMessage(searchParams.category_error) ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {categoryErrorMessage(searchParams.category_error)}
        </div>
      ) : null}

      {/* ============== بنكي (collapsible) ============== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">بنكي</h2>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">
            {banks.length} بنك
          </span>
        </div>

        {banks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            لم تنشئ بنك أسئلة بعد.
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
                  {bankQuestions.length} سؤال
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
                  <div className="text-xs text-red-700">
                    ⚠️ حذف البنك سيحذف جميع الأسئلة داخله.
                  </div>
                  <DeleteBankForm
                    bankId={bank.id}
                    bankName={bank.name}
                    questionCount={bankQuestions.length}
                  />
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <h4 className="font-semibold">استيراد الأسئلة من Excel</h4>
                  <p className="mt-1 mb-3 text-sm text-neutral-600">
                    تتم مراجعة الملف أولًا. لا يتم حفظ أي سؤال إذا وُجد خطأ
                    واحد.
                  </p>
                  <p className="mb-3 rounded-md bg-blue-50 p-3 text-xs text-blue-900">
                    تُنشئ قيمة «YA» في ملف Excel سجلًا لوسائط متوقعة فقط؛ لا
                    تُرفع الملفات الثنائية مع الاستيراد. ارفع الملف من بطاقة
                    السؤال لاحقًا بالاسم المطابق تمامًا لعمود «Nama Media».
                  </p>
                  <QuestionBankImportForm questionBankId={bank.id} />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-semibold">الأسئلة المحفوظة</h4>
                    <span className="text-sm text-neutral-500">
                      {filteredBankQuestions.length} / {bankQuestions.length}{" "}
                      سؤال
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
                        الكل ({bankQuestions.length})
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
                            بدون موضوع ({noneCount})
                          </Link>
                        );
                      })()}
                    </div>
                  ) : null}

                  {filteredBankQuestions.length === 0 ? (
                    <div className="mt-4 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center text-sm text-neutral-500">
                      {bankQuestions.length === 0
                        ? "لا توجد أسئلة محفوظة في هذا البنك."
                        : "لا توجد أسئلة تطابق الفلتر المحدد."}
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
                              <span>السؤال {index + 1}</span>
                              {question.category_id ? (
                                <span className="rounded-full bg-neutral-100 px-2 py-1">
                                  {categoryMap.get(question.category_id) ??
                                    "موضوع غير معروف"}
                                </span>
                              ) : null}
                              {question.difficulty ? (
                                <span className="rounded-full bg-neutral-100 px-2 py-1">
                                  {difficultyLabel[question.difficulty]}
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-3 text-base font-medium leading-8">
                              {question.question_text || "سؤال بلا نص"}
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
                                    {option?.option_text ||
                                      "الخيار غير موجود"}
                                    {isCorrect ? (
                                      <span className="mr-2 text-xs font-semibold">
                                        ✓ الإجابة الصحيحة
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
                              categories={(categories ?? []).map(
                                (category) => ({
                                  id: category.id,
                                  name: category.name,
                                }),
                              )}
                              mediaCount={
                                (
                                  mediaByQuestion.get(question.id) ?? []
                                ).length
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

      {/* ============== إنشاء بنك جديد ============== */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">إنشاء بنك جديد</h2>
        <form action={createQuestionBank} className="mt-4 grid gap-3">
          <input
            name="name"
            required
            maxLength={100}
            placeholder="مثال: النحو الأساسي"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            maxLength={500}
            placeholder="وصف اختياري"
            rows={3}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            إنشاء بنك الأسئلة
          </button>
        </form>
      </section>

      {/* ============== موضوعات الأسئلة ============== */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">موضوعات الأسئلة</h2>
            <p className="mt-1 text-sm text-neutral-600">
              أنشئ الموضوعات التي ستستخدم أسماءها في عمود «Topik» داخل قالب
              Excel.
            </p>
          </div>
          <span className="text-sm text-neutral-500">
            {categories?.length ?? 0} موضوع
          </span>
        </div>

        <form
          action={createQuestionCategory}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="category-name" className="sr-only">
            اسم الموضوع
          </label>
          <input
            id="category-name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="مثال: النحو الأساسي"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            إضافة موضوع
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
                      اسم الموضوع
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
                      حفظ
                    </button>
                  </form>
                  <form action={deleteQuestionCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      حذف
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center text-sm text-neutral-500">
            لا توجد موضوعات بعد. أنشئ موضوعًا أولًا قبل استيراد الأسئلة.
          </div>
        )}
      </section>

      <AiPromptSection />

      {/* ============== قالب Excel ============== */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">قالب Excel الرسمي</h2>
            <p className="mt-1 text-sm text-neutral-600">
              القالب يحتوي على 140 صفًا جاهزًا للإدخال ولا يحتوي على أسئلة
              حقيقية.
            </p>
          </div>
          <a
            href="/templates/question-bank-template.xlsx"
            download
            className="w-fit rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            تنزيل القالب
          </a>
        </div>
      </section>
    </div>
  );
}