import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

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

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.dashboard;
  const cd = dict.class_detail;

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, subject, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const classIds = classes?.map((c) => c.id) ?? [];

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
      label: t.stat_classes,
      value: classes?.length ?? 0,
      emoji: "🏫",
      href: "/dashboard/classes",
      ring: "border-teal-500/20",
      bg: "bg-teal-50",
      text: "text-teal-700",
      badge: "bg-teal-500",
    },
    {
      label: t.stat_students,
      value: studentCount,
      emoji: "👥",
      href: "/dashboard/students",
      ring: "border-sage-500/30",
      bg: "bg-sage-50",
      text: "text-sage-600",
      badge: "bg-sage-500",
    },
    {
      label: t.stat_materials,
      value: materialCount,
      emoji: "📖",
      href: "/dashboard/classes",
      ring: "border-terracotta-500/25",
      bg: "bg-terracotta-50",
      text: "text-terracotta-600",
      badge: "bg-terracotta-500",
    },
    {
      label: t.stat_questions,
      value: questionsRes.count ?? 0,
      emoji: "❓",
      href: "/dashboard/question-banks",
      ring: "border-teal-500/20",
      bg: "bg-teal-50",
      text: "text-teal-700",
      badge: "bg-teal-500",
    },
    {
      label: t.stat_games,
      value: gamesRes.count ?? 0,
      emoji: "🎮",
      href: "/dashboard/games",
      ring: "border-terracotta-500/25",
      bg: "bg-terracotta-50",
      text: "text-terracotta-600",
      badge: "bg-terracotta-500",
    },
  ];

  const recentClasses = classes?.slice(0, 4) ?? [];
  const isRtl = locale === "ar";

  return (
    <main className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-terracotta-500/30 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-semibold text-white/75">
            {dict.common.brand_top}
          </p>
          <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">
            👋 {t.welcome}
          </h1>
          <p className="mt-2 text-sm text-white/85">{t.welcome_desc}</p>
        </div>
      </header>

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
                →
              </span>
            </div>
            <p className={`mt-4 text-3xl font-black ${s.text}`}>
              {s.value.toLocaleString(locale === "ar" ? "ar-EG" : locale)}
            </p>
            <p className={`mt-1 text-xs font-bold ${s.text} opacity-80`}>
              {s.label}
            </p>
          </Link>
        ))}
      </section>

      <section className="grid gap-5 md:grid-cols-4">
        <Link href="/dashboard/classes" className="group aesthetic-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">🏫</p>
              <h2 className="font-display mt-4 font-black text-teal-700">
                {t.stat_classes}
              </h2>
              <p className="mt-2 text-sm leading-6 text-softslate/80">
                {t.welcome_desc}
              </p>
            </div>
            <span className="rounded-full bg-teal-500 px-3 py-1 text-xs font-bold text-white">
              →
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/question-banks"
          className="group aesthetic-card"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">📚</p>
              <h2 className="font-display mt-4 font-black text-teal-700">
                {dict.home.feat_bank_title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-softslate/80">
                {dict.home.feat_bank_desc}
              </p>
            </div>
            <span className="rounded-full bg-sage-500 px-3 py-1 text-xs font-bold text-white">
              →
            </span>
          </div>
        </Link>

        <Link href="/dashboard/games" className="group aesthetic-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">🎮</p>
              <h2 className="font-display mt-4 font-black text-teal-700">
                {t.stat_games}
              </h2>
              <p className="mt-2 text-sm leading-6 text-softslate/80">
                {dict.home.feat_modes_desc}
              </p>
            </div>
            <span className="rounded-full bg-terracotta-500 px-3 py-1 text-xs font-bold text-white">
              →
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/assessments"
          className="group rounded-3xl border-2 border-terracotta-500/40 bg-gradient-to-br from-terracotta-500 to-terracotta-600 p-6 text-white shadow-md transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">🎓</p>
              <h2 className="font-display mt-4 font-black">
                Ujian TOEFL / TOAFL
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/85">
                Buat simulasi TOEFL ITP atau TOAFL resmi.
              </p>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
              →
            </span>
          </div>
        </Link>
      </section>

      {recentClasses.length > 0 ? (
        <section className="aesthetic-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-black text-teal-700">
                🕒 {t.recent_classes}
              </h2>
              <p className="mt-1 text-xs text-softslate/70">
                {t.recent_classes_desc}
              </p>
            </div>
            <Link
              href="/dashboard/classes"
              className="rounded-full border border-sage-200 bg-sage-50 px-4 py-2 text-xs font-bold text-sage-600 transition hover:bg-sage-100"
            >
              {t.view_all}
            </Link>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {recentClasses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/classes/${c.id}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-sage-200/60 bg-white p-4 transition hover:border-terracotta-500/50 hover:bg-terracotta-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-teal-700 group-hover:text-terracotta-600">
                      {c.name}
                    </p>
                    <p className="mt-0.5 text-xs text-softslate/70">
                      {c.subject ?? cd.no_subject} ·{" "}
                      {new Date(c.created_at).toLocaleDateString(
                        locale === "ar" ? "ar-EG" : locale,
                      )}
                    </p>
                  </div>
                  <span className="text-2xl text-sage-500 transition group-hover:text-terracotta-500">
                    {isRtl ? "←" : "→"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="aesthetic-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-sage-600">
              {t.stat_students}
            </p>
            <h2 className="font-display mt-1 text-2xl font-black text-teal-700">
              {t.students_mgmt}
            </h2>
            <p className="mt-2 text-sm text-softslate/80">
              {t.students_mgmt_desc}
            </p>
          </div>
          <Link href="/dashboard/students" className="btn-primary">
            {t.open_students}
          </Link>
        </div>
      </section>
    </main>
  );
}