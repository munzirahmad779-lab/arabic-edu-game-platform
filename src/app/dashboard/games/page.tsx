import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createGame, createRoom } from "./actions";

type SearchParams = {
  error?: string;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid":
      return "بيانات اللعبة غير صحيحة.";
    case "invalid_class":
      return "الفصل غير موجود أو لا تملك صلاحية الوصول إليه.";
    case "invalid_questions":
      return "توجد أسئلة غير صالحة أو غير متاحة لحسابك.";
    case "create_failed":
      return "تعذر إنشاء اللعبة. حاول مرة أخرى.";
    default:
      return null;
  }
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [
    { data: classes, error: classesError },
    { data: banks, error: banksError },
    { data: games, error: gamesError },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("name"),

    supabase
      .from("question_banks")
      .select("id, name, description, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("games")
      .select(
        "id, name, class_id, game_type, mode, duration_seconds, ranking_visibility, created_at",
      )
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

if (classesError || banksError || gamesError) {
  console.error("Games page query errors:", {
    classesError,
    banksError,
    gamesError,
  });

  throw new Error(
    [
      classesError ? `classes: ${classesError.message}` : "",
      banksError ? `question_banks: ${banksError.message}` : "",
      gamesError ? `games: ${gamesError.message}` : "",
    ]
      .filter(Boolean)
      .join(" | ") || "تعذر تحميل بيانات الألعاب."
  );
}

  const errorMessage = getErrorMessage(searchParams.error);

  return (
    <main className="space-y-8" dir="rtl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            منصة التعليم العربية
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">الألعاب</h1>
          <p className="mt-2 text-sm text-neutral-600">
            أنشئ لعبة واستخدم أسئلتك الحالية في تجربة تعليمية تفاعلية.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          لوحة التحكم
        </Link>
      </header>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">إنشاء لعبة جديدة</h2>
          <p className="mt-1 text-sm text-neutral-500">
            اختر الفصل والأسئلة ثم اضبط طريقة اللعب.
          </p>
        </div>

        {classes.length === 0 ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            أنشئ فصلًا دراسيًا أولًا قبل إنشاء اللعبة.
          </div>
        ) : banks.length === 0 ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            أنشئ بنك أسئلة أولًا قبل إنشاء اللعبة.
          </div>
        ) : (
          <form action={createGame} className="mt-6 space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="game-name" className="block text-sm font-medium">
                  اسم اللعبة
                </label>
                <input
                  id="game-name"
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  placeholder="مثال: مراجعة المفردات"
                  className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                />
              </div>

              <div>
                <label htmlFor="class-id" className="block text-sm font-medium">
                  الفصل الدراسي
                </label>
                <select
                  id="class-id"
                  name="class_id"
                  required
                  defaultValue=""
                  className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="" disabled>
                    اختر الفصل
                  </option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="mode" className="block text-sm font-medium">
                  وضع اللعبة
                </label>
                <select
                  id="mode"
                  name="mode"
                  defaultValue="competitive"
                  className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="competitive">تنافسي</option>
                  <option value="learning">تعليمي</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="duration-seconds"
                  className="block text-sm font-medium"
                >
                  مدة اللعبة بالثواني
                </label>
                <input
                  id="duration-seconds"
                  name="duration_seconds"
                  type="number"
                  min={30}
                  max={3600}
                  step={30}
                  defaultValue={300}
                  required
                  className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="ranking-visibility"
                  className="block text-sm font-medium"
                >
                  إظهار الترتيب
                </label>
                <select
                  id="ranking-visibility"
                  name="ranking_visibility"
                  defaultValue="full"
                  className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="full">للجميع</option>
                  <option value="hidden">مخفي</option>
                  <option value="self_only">لللاعب نفسه</option>
                </select>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium">
                اختر الأسئلة
              </legend>

              <div className="mt-4 space-y-5">
                {banks.map((bank) => (
                  <div
                    key={bank.id}
                    className="rounded-lg border border-neutral-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{bank.name}</h3>
                        {bank.description ? (
                          <p className="mt-1 text-sm text-neutral-500">
                            {bank.description}
                          </p>
                        ) : null}
                      </div>

                      <Link
                        href={`/dashboard/question-banks?bankId=${bank.id}`}
                        className="text-sm text-neutral-600 underline"
                      >
                        فتح البنك
                      </Link>
                    </div>

                    <QuestionsForBank
                      bankId={bank.id}
                      teacherId={user.id}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              className="w-full rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              إنشاء اللعبة
            </button>
          </form>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">ألعابي</h2>
          <p className="mt-1 text-sm text-neutral-500">
            الألعاب التي أنشأها حسابك الحالي.
          </p>
        </div>

        {games.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
            لا توجد ألعاب بعد.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => {
              const className =
                classes.find((item) => item.id === game.class_id)?.name ??
                "بدون فصل";

              return (
                <article
                  key={game.id}
                  className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{game.name}</h3>
                      <p className="mt-2 text-sm text-neutral-500">
                        {className}
                      </p>
                    </div>

                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                      سباق الكلمات
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-violet-50 p-3">
                      <div className="text-xs text-violet-600">الوضع</div>
                      <div className="mt-1 font-medium text-violet-950">
                        {game.mode === "competitive"
                          ? "تنافسي"
                          : "تعليمي"}
                      </div>
                    </div>

                    <div className="rounded-md bg-amber-50 p-3">
                      <div className="text-xs text-amber-700">المدة</div>
                      <div className="mt-1 font-medium text-amber-950">
                        {game.duration_seconds} ث
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <form action={createRoom} className="flex-1">
                      <input type="hidden" name="game_id" value={game.id} />
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
                      >
                        ▶ تشغيل اللعبة
                      </button>
                    </form>

                    <Link
                      href={`/dashboard/games/${game.id}/room`}
                      className="rounded-lg border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
                    >
                      معاينة
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

async function QuestionsForBank({
  bankId,
  teacherId,
}: {
  bankId: string;
  teacherId: string;
}) {
  const supabase = await createClient();

  const { data: questions, error } = await supabase
    .from("questions")
    .select(
      "id, question_text, difficulty, correct_option_key",
    )
    .eq("question_bank_id", bankId)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <p className="mt-3 text-sm text-red-700">
        تعذر تحميل أسئلة هذا البنك.
      </p>
    );
  }

  if (!questions?.length) {
    return (
      <p className="mt-3 text-sm text-neutral-500">
        لا توجد أسئلة في هذا البنك.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {questions.map((question, index) => (
        <label
          key={question.id}
          className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 p-3 transition hover:bg-neutral-50"
        >
          <input
            type="checkbox"
            name="question_id"
            value={question.id}
            className="mt-1 h-4 w-4"
          />

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {index + 1}. {question.question_text}
            </span>

            <span className="mt-1 block text-xs text-neutral-500">
              {question.difficulty === "easy"
                ? "سهل"
                : question.difficulty === "medium"
                  ? "متوسط"
                  : "صعب"}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}


