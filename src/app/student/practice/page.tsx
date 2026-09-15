import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";

type PracticeGame = {
  id: string;
  name: string;
  mode: "endless" | "practice";
  question_count: number;
};

const MODE_LABEL: Record<string, string> = {
  endless: "بلا نهاية",
  practice: "تمرين",
};

const MODE_COLOR: Record<string, string> = {
  endless: "bg-emerald-100 text-emerald-800",
  practice: "bg-violet-100 text-violet-800",
};

export default async function StudentPracticePage() {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_list_practice_games", {
    p_token: token,
  });

  if (error) {
    console.error("[StudentPracticePage]", error);
  }

  const games = (data ?? []) as PracticeGame[];

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-4 sm:p-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <nav>
          <Link
            href="/student"
            className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
          >
            <span>→</span>
            <span>رجوع إلى الصفحة الرئيسية</span>
          </Link>
        </nav>

        <header className="rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-bold text-white/75">بوابة الطالب</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            🎯 التدريب الذاتي
          </h1>
          <p className="mt-3 text-sm text-white/85">
            تدرّب على أسئلة معلمك بحرية. لا يوجد وقت، ويمكنك مراجعة كل سؤال
            وإجابته في أي وقت.
          </p>
          <p className="mt-2 text-xs text-white/70">
            الصف: <span className="font-bold">{session.class_name}</span>
          </p>
        </header>

        {games.length === 0 ? (
          <section className="rounded-[2rem] border-2 border-dashed border-neutral-200 bg-white p-12 text-center shadow-lg">
            <div className="text-6xl">📚</div>
            <p className="mt-4 font-bold text-neutral-700">
              لا يوجد تدريب متاح بعد
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              في انتظار أن يضيف معلمك تدريبات (بلا نهاية أو تمرين).
            </p>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-neutral-900">
                التدريبات المتاحة
              </h2>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                {games.length} تدريب
              </span>
            </div>

            <ul className="space-y-3">
              {games.map((game) => (
                <li key={game.id}>
                  <Link
                    href={`/student/practice/${game.id}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:shadow-md"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-md transition group-hover:scale-110">
                        🎯
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-neutral-900 group-hover:text-violet-700">
                          {game.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              MODE_COLOR[game.mode] ??
                              "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            {MODE_LABEL[game.mode] ?? game.mode}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {game.question_count} سؤال
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-2xl text-neutral-400 transition group-hover:text-violet-600">
                      ←
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
          <p className="font-black">💡 كيف يعمل التدريب الذاتي؟</p>
          <ul className="mt-2 list-disc space-y-1 pr-5">
            <li>اختر تدريبًا من القائمة أعلاه.</li>
            <li>ستظهر الأسئلة واحدًا تلو الآخر — بدون وقت.</li>
            <li>
              بعد كل إجابة، سترى إن كانت صحيحة أو خاطئة، ويمكنك عرض سبب
              الإجابة.
            </li>
            <li>
              تقدمك محفوظ — يمكنك العودة لاحقًا ومراجعة جميع إجاباتك، أو
              البدء من جديد.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}