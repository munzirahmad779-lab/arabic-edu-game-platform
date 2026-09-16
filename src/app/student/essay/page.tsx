import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";

type EssayRow = {
  id: string;
  title: string;
  duration_minutes: number;
  has_submission: boolean;
  ai_score: number | null;
  submitted_at: string | null;
};

export default async function StudentEssayListPage() {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("student_list_essays", {
    p_token: token,
  });

  if (error) {
    console.error("[StudentEssayListPage]", error);
  }

  const essays = (data ?? []) as EssayRow[];

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 sm:p-6"
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
            ✍️ مهام الكتابة
          </h1>
          <p className="mt-3 text-sm text-white/85">
            اكتب إجابتك ثم سلّمها — سيتم تصحيحها تلقائيًا بالذكاء الاصطناعي،
            وستحصل على ملاحظات تفصيلية.
          </p>
          <p className="mt-2 text-xs text-white/70">
            الصف: <span className="font-bold">{session.class_name}</span>
          </p>
        </header>

        {essays.length === 0 ? (
          <section className="rounded-[2rem] border-2 border-dashed border-neutral-200 bg-white p-12 text-center shadow-lg">
            <div className="text-6xl">📝</div>
            <p className="mt-4 font-bold text-neutral-700">
              لا توجد مهام كتابة بعد
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              في انتظار أن يضيف معلمك مهمة.
            </p>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-neutral-900">
                المهام المتاحة
              </h2>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                {essays.length} مهمة
              </span>
            </div>

            <ul className="space-y-3">
              {essays.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/student/essay/${e.id}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:shadow-md"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-md transition group-hover:scale-110">
                        ✍️
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-neutral-900 group-hover:text-violet-700">
                          {e.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-bold text-neutral-600">
                            ⏱ {e.duration_minutes} دقيقة
                          </span>
                          {e.has_submission ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                              ✓ تم التسليم
                              {e.ai_score !== null
                                ? ` — ${e.ai_score}/100`
                                : ""}
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">
                              لم تبدأ بعد
                            </span>
                          )}
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
      </div>
    </main>
  );
}