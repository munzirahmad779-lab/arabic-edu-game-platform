import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ClassDetailPage({
  params,
}: {
  params: { classId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, name, subject, created_at")
    .eq("id", params.classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (classError || !classRow) {
    notFound();
  }

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name, created_at")
    .eq("class_id", classRow.id)
    .order("name");

  if (studentsError) {
    throw new Error("تعذر تحميل الطلاب.");
  }

  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("id, name, mode, duration_seconds, created_at")
    .eq("class_id", classRow.id)
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (gamesError) {
    throw new Error("تعذر تحميل الألعاب.");
  }

  return (
    <main className="space-y-8" dir="rtl">
      <div>
        <Link
          href="/dashboard/classes"
          className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
        >
          ← العودة إلى الفصول
        </Link>
      </div>

      <header className="rounded-2xl bg-gradient-to-l from-indigo-700 via-violet-700 to-fuchsia-600 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/75">الفصل الدراسي</p>
            <h1 className="mt-1 text-3xl font-black sm:text-4xl">
              {classRow.name}
            </h1>
            <p className="mt-2 text-sm text-white/85">
              المادة: <span className="font-bold">{classRow.subject ?? "بدون مادة"}</span>
            </p>
            <p className="mt-1 text-xs text-white/70">
              تم الإنشاء: {new Date(classRow.created_at).toLocaleDateString("ar-EG")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/students?classId=${classRow.id}`}
              className="rounded-2xl bg-white/15 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              إدارة الطلاب
            </Link>
            <Link
              href={`/dashboard/classes?edit=${classRow.id}`}
              className="rounded-2xl bg-white/15 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              تعديل الفصل
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-center">
          <div className="text-xs font-bold text-sky-700">الطلاب</div>
          <div className="mt-2 text-3xl font-black text-sky-950">
            {students?.length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 text-center">
          <div className="text-xs font-bold text-violet-700">الألعاب</div>
          <div className="mt-2 text-3xl font-black text-violet-950">
            {games?.length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-center">
          <div className="text-xs font-bold text-amber-700">المواد الدراسية</div>
          <div className="mt-2 text-3xl font-black text-amber-950">0</div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">المواد الدراسية</h2>
            <p className="mt-1 text-sm text-neutral-500">
              ستظهر هنا المواد التي تشاركها مع طلابك.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <div className="text-4xl">📖</div>
          <p className="mt-3 font-bold text-neutral-700">
            قريبًا: إضافة المواد الدراسية
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            سيتم تفعيل هذه الميزة في التحديث القادم.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">الطلاب في هذا الفصل</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {students?.length ?? 0} طالب مسجل.
            </p>
          </div>
          <Link
            href={`/dashboard/students?classId=${classRow.id}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            إدارة الطلاب
          </Link>
        </div>

        {!students || students.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <div className="text-4xl">👥</div>
            <p className="mt-3 font-bold text-neutral-700">
              لا يوجد طلاب في هذا الفصل بعد
            </p>
            <Link
              href={`/dashboard/students?classId=${classRow.id}`}
              className="mt-4 inline-flex rounded-2xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
            >
              إضافة طلاب
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student, index) => (
              <div
                key={student.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-black text-white">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-neutral-900">
                    {student.name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {new Date(student.created_at).toLocaleDateString("ar-EG")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">الألعاب المرتبطة بهذا الفصل</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {games?.length ?? 0} لعبة.
            </p>
          </div>
          <Link
            href="/dashboard/games"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            إدارة الألعاب
          </Link>
        </div>

        {!games || games.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <div className="text-4xl">🎮</div>
            <p className="mt-3 font-bold text-neutral-700">
              لا توجد ألعاب لهذا الفصل بعد
            </p>
            <Link
              href="/dashboard/games"
              className="mt-4 inline-flex rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
            >
              إنشاء لعبة
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.id}
                className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-bold text-neutral-900">{game.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {game.mode === "competitive" ? "تنافسي" : "تعليمي"} ·{" "}
                    {game.duration_seconds} ثانية
                  </div>
                </div>
                <Link
                  href="/dashboard/games"
                  className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100"
                >
                  فتح في الألعاب
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}