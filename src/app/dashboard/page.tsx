import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type StatCard = {
  label: string;
  value: number;
  emoji: string;
  href: string;
  ring: string;
  bg: string;
  text: string;
  badge: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Kelas guru (dipakai juga untuk daftar terbaru)
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, subject, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const classIds = classes?.map((c) => c.id) ?? [];

  // Siswa + materi hanya dihitung kalau guru punya kelas
  let studentCount = 0;
  let materialCount = 0;

  if (classIds.length > 0) {
    const [studentsRes, materialsRes] = await Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds),
      supabase
        .from("class_materials")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds),
    ]);
    studentCount = studentsRes.count ?? 0;
    materialCount = materialsRes.count ?? 0;
  }

  const [questionsRes, gamesRes] = await Promise.all([
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", user.id),
    supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", user.id),
  ]);

  const stats: StatCard[] = [
    {
      label: "الفصول",
      value: classes?.length ?? 0,
      emoji: "🏫",
      href: "/dashboard/classes",
      ring: "border-sky-200",
      bg: "bg-sky-50",
      text: "text-sky-950",
      badge: "bg-sky-600",
    },
    {
      label: "الطلاب",
      value: studentCount,
      emoji: "👥",
      href: "/dashboard/students",
      ring: "border-emerald-200",
      bg: "bg-emerald-50",
      text: "text-emerald-950",
      badge: "bg-emerald-600",
    },
    {
      label: "المواد",
      value: materialCount,
      emoji: "📖",
      href: "/dashboard/classes",
      ring: "border-amber-200",
      bg: "bg-amber-50",
      text: "text-amber-950",
      badge: "bg-amber-600",
    },
    {
      label: "الأسئلة",
      value: questionsRes.count ?? 0,
      emoji: "❓",
      href: "/dashboard/question-banks",
      ring: "border-fuchsia-200",
      bg: "bg-fuchsia-50",
      text: "text-fuchsia-950",
      badge: "bg-fuchsia-600",
    },
    {
      label: "الألعاب",
      value: gamesRes.count ?? 0,
      emoji: "🎮",
      href: "/dashboard/games",
      ring: "border-violet-200",
      bg: "bg-violet-50",
      text: "text-violet-950",
      badge: "bg-violet-600",
    },
  ];

  const recentClasses = classes?.slice(0, 4) ?? [];

  return (
    <main className="space-y-8" dir="rtl">
      <header className="rounded-[2rem] bg-gradient-to-l from-indigo-700 via-violet-700 to-fuchsia-600 p-6 text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold text-white/75">
          منصة التعليم العربية
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
          مرحبًا بك 👋
        </h1>
        <p className="mt-2 text-sm text-white/85">
          إدارة الفصول الدراسية وبنك الأسئلة وبناء الألعاب، كل شيء في مكان واحد.
        </p>
      </header>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`group rounded-2xl border ${s.ring} ${s.bg} p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl">{s.emoji}</span>
              <span
                className={`rounded-full ${s.badge} px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100`}
              >
                فتح
              </span>
            </div>
            <p className={`mt-4 text-3xl font-black ${s.text}`}>
              {s.value.toLocaleString("ar-EG")}
            </p>
            <p className={`mt-1 text-xs font-bold ${s.text} opacity-80`}>
              {s.label}
            </p>
          </Link>
        ))}
      </section>

      {/* Quick actions */}
      <section className="grid gap-5 md:grid-cols-3">
        <Link
          href="/dashboard/classes"
          className="group rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-sky-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">🏫</p>
              <h2 className="mt-4 font-bold text-sky-950">الفصول الدراسية</h2>
              <p className="mt-2 text-sm leading-6 text-sky-800">
                إنشاء الفصول الدراسية وإدارتها.
              </p>
            </div>
            <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white">
              فتح
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/question-banks"
          className="group rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">📚</p>
              <h2 className="mt-4 font-bold text-emerald-950">بنك الأسئلة</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                إنشاء بنوك الأسئلة واستيرادها من Excel.
              </p>
            </div>
            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
              فتح
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/games"
          className="group rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-violet-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">🎮</p>
              <h2 className="mt-4 font-bold text-violet-950">بناء الألعاب</h2>
              <p className="mt-2 text-sm leading-6 text-violet-800">
                إنشاء الألعاب التعليمية وإدارتها وتشغيلها.
              </p>
            </div>
            <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
              فتح
            </span>
          </div>
        </Link>
      </section>

      {/* Recent classes */}
      {recentClasses.length > 0 ? (
        <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-neutral-900">
                🕒 أحدث الفصول
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                آخر 4 فصول قمت بإنشائها.
              </p>
            </div>
            <Link
              href="/dashboard/classes"
              className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100"
            >
              عرض الكل
            </Link>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {recentClasses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/classes/${c.id}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-violet-300 hover:bg-violet-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-neutral-900 group-hover:text-violet-700">
                      {c.name}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {c.subject ?? "بدون مادة"} ·{" "}
                      {new Date(c.created_at).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <span className="text-2xl text-neutral-300 transition group-hover:text-violet-600">
                    ←
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Students management */}
      <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-emerald-600">الطلاب</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              إدارة الطلاب
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              أضف الطلاب إلى فصولك وأنشئ PIN لكل طالب.
            </p>
          </div>
          <Link
            href="/dashboard/students"
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-600"
          >
            فتح إدارة الطلاب
          </Link>
        </div>
      </section>
    </main>
  );
}