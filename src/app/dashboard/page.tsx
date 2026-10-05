import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { QuickActionsBar } from "@/components/quick-actions-bar";

type ClassCard = {
  id: string;
  name: string;
  subject: string | null;
  studentCount: number;
};

type ActivityItem = {
  id: string;
  icon: string;
  text: string;
  subtext: string;
  date: string;
  href: string;
};

function fmt(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

const DOT_COLORS = [
  "bg-terracotta-400",
  "bg-sage-400",
  "bg-teal-400",
  "bg-amber-400",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.dashboard;
  const th = dict.dashboard_home;
  const cd = dict.class_detail;
  const isRtl = locale === "ar";

  // ============================================================
  // KELAS + JUMLAH SISWA
  // ============================================================
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, subject, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const classIds = classes?.map((c) => c.id) ?? [];

  const studentCounts = new Map<string, number>();
  let totalStudents = 0;

  if (classIds.length > 0) {
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, class_id")
      .in("class_id", classIds);

    for (const s of studentRows ?? []) {
      studentCounts.set(s.class_id, (studentCounts.get(s.class_id) ?? 0) + 1);
      totalStudents += 1;
    }
  }

  const classCards: ClassCard[] = (classes ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    studentCount: studentCounts.get(c.id) ?? 0,
  }));

  const { count: totalMaterials } = await supabase
    .from("class_materials")
    .select("id", { count: "exact", head: true })
    .in(
      "class_id",
      classIds.length > 0 ? classIds : ["00000000-0000-0000-0000-000000000000"],
    );

  // ============================================================
  // PERLU PERHATIAN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [essaysPendingRes, examsActiveRes] = await Promise.all([
    db
      .from("essay_submissions")
      .select("id", { count: "exact", head: true })
      .is("teacher_override_score", null)
      .is("ai_score", null),
    db
      .from("assessment_tokens")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString()),
  ]);

  const essaysPending = essaysPendingRes?.count ?? 0;
  const examsActive = examsActiveRes?.count ?? 0;
  const hasAttention = essaysPending > 0 || examsActive > 0;

  // ============================================================
  // AKTIVITAS TERAKHIR
  // ============================================================
  const recentActivities: ActivityItem[] = [];

  const [recentClasses, recentGames, recentExams] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("games")
      .select("id, name, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    db
      .from("assessments")
      .select("id, title, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  for (const c of recentClasses.data ?? []) {
    recentActivities.push({
      id: `class-${c.id}`,
      icon: "🏫",
      text: c.name,
      subtext: th.activity_class_created,
      date: c.created_at,
      href: `/dashboard/classes/${c.id}`,
    });
  }

  for (const g of recentGames.data ?? []) {
    recentActivities.push({
      id: `game-${g.id}`,
      icon: "🎮",
      text: g.name,
      subtext: th.activity_game_played,
      date: g.created_at,
      href: "/dashboard/games",
    });
  }

  for (const e of recentExams.data ?? []) {
    recentActivities.push({
      id: `exam-${e.id}`,
      icon: "📝",
      text: e.title,
      subtext: th.activity_exam_created,
      date: e.created_at,
      href: "/dashboard/assessments",
    });
  }

  recentActivities.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const topActivities = recentActivities.slice(0, 4);

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "";

  return (
    <main className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* ============ LOGO BANNER (centered) ============ */}
      <section className="flex flex-col items-center justify-center gap-2 pt-2">
        <Image
          src="/logo-horizontal.png"
          alt={dict.common.brand_main}
          width={260}
          height={114}
          className="h-14 w-auto sm:h-16"
          priority
        />
      </section>

      {/* ============ HERO — TEAL BERSIH ============ */}
      <section className="rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/75">
              {dict.common.brand_top}
            </p>
            <h1 className="font-display mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">
              👋 {fmt(th.welcome_title.replace(" 👋", ""), { name: displayName })}
            </h1>
            <p className="mt-1.5 text-sm text-white/85">
              {th.welcome_subtitle}
            </p>
          </div>

          <div className="flex gap-2">
            <div className="rounded-2xl bg-white/20 px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-black tabular-nums leading-none text-white">
                {classCards.length}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/85">
                {t.stat_classes}
              </p>
            </div>
            <div className="rounded-2xl bg-white/20 px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-black tabular-nums leading-none text-white">
                {totalStudents}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/85">
                {t.stat_students}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ KELAS SAYA ============ */}
      <section className="rounded-[2rem] border border-sage-200/60 bg-white p-5 shadow-md sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-black text-teal-800">
            🏫 {th.my_classes_title.replace("🏫 ", "")}
          </h2>
          <Link
            href="/dashboard/classes"
            className="rounded-full border border-sage-200 bg-sage-50 px-3 py-1.5 text-xs font-bold text-sage-700 transition hover:bg-sage-100"
          >
            {th.view_all} {isRtl ? "←" : "→"}
          </Link>
        </div>

        {classCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sage-200 bg-sage-50/40 p-8 text-center">
            <div className="text-4xl">🏫</div>
            <p className="mt-3 text-sm font-bold text-teal-700">
              {th.empty_classes}
            </p>
            <Link
              href="/dashboard/classes"
              className="mt-4 inline-flex rounded-full bg-terracotta-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-terracotta-600"
            >
              {th.quick_add_class}
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {classCards.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/classes/${c.id}`}
                className="group rounded-2xl border border-sage-200/70 bg-white p-5 transition hover:-translate-y-0.5 hover:border-terracotta-300 hover:bg-terracotta-50/40 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-terracotta-500 to-terracotta-600 text-lg font-black text-white shadow-sm">
                    {c.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-teal-800">
                      {c.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-softslate/70">
                      {c.subject ?? cd.no_subject}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-softslate/80">
                    <span>👥</span>
                    <span>
                      {c.studentCount} {th.students_count_suffix}
                    </span>
                  </span>
                  <span className="rounded-full bg-terracotta-500 px-3.5 py-1.5 text-[11px] font-black text-white shadow-sm transition group-hover:bg-terracotta-600">
                    {th.open_class} {isRtl ? "←" : "→"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ============ PERLU PERHATIAN + AKTIVITAS ============ */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-sage-200/60 bg-white p-5 shadow-md sm:p-6">
          <h2 className="font-display mb-4 text-lg font-black text-teal-800">
            {th.needs_attention_title}
          </h2>

          {hasAttention ? (
            <ul className="space-y-2.5">
              {essaysPending > 0 ? (
                <AttentionRow
                  icon="📝"
                  text={fmt(th.attention_essays, { n: essaysPending })}
                  cta={th.attention_essays_cta}
                  href="/dashboard/classes"
                  tone="warm"
                />
              ) : null}

              {examsActive > 0 ? (
                <AttentionRow
                  icon="🧪"
                  text={fmt(th.attention_exams, { n: examsActive })}
                  cta={th.attention_exams_cta}
                  href="/dashboard/assessments"
                  tone="info"
                />
              ) : null}
            </ul>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center">
              <div className="text-5xl">✓</div>
              <p className="mt-3 text-base font-black text-emerald-800">
                {th.all_safe}
              </p>
              <p className="mt-1 text-xs text-emerald-700/80">
                {th.all_safe_desc}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-sage-200/60 bg-white p-5 shadow-md sm:p-6">
          <h2 className="font-display mb-4 text-lg font-black text-teal-800">
            {th.recent_activity_title}
          </h2>

          {topActivities.length === 0 ? (
            <p className="py-6 text-center text-sm text-softslate/70">
              {th.empty_activities}
            </p>
          ) : (
            <ul className="relative space-y-4 ps-6">
              <span className="absolute bottom-3 start-2 top-3 w-px bg-sage-200" />
              {topActivities.map((a, i) => (
                <li key={a.id} className="relative">
                  <span
                    className={`absolute -start-6 top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${DOT_COLORS[i % DOT_COLORS.length]}`}
                  />
                  <Link
                    href={a.href}
                    className="block rounded-xl px-2 py-1.5 transition hover:bg-sage-50"
                  >
                    <p className="flex items-center gap-2 text-sm font-bold text-teal-800">
                      <span>{a.icon}</span>
                      <span className="truncate">{a.text}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-softslate/70">
                      {a.subtext} ·{" "}
                      {new Date(a.date).toLocaleDateString(
                        locale === "ar" ? "ar-EG" : locale,
                        { day: "numeric", month: "short" },
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ============ AKSI CEPAT ============ */}
      <QuickActionsBar
        title={th.quick_actions_title}
        actions={[
          {
            href: "/dashboard/classes",
            label: th.quick_add_class,
            tone: "coral",
          },
          {
            href: "/dashboard/students",
            label: th.quick_add_student,
            tone: "sage",
          },
          {
            href: "/dashboard/classes",
            label: th.quick_add_material,
            tone: "sage",
          },
          {
            href: "/dashboard/question-banks",
            label: th.quick_add_question,
            tone: "blue",
          },
          {
            href: "/dashboard/games",
            label: th.quick_add_game,
            tone: "purple",
          },
          {
            href: "/dashboard/assessments",
            label: th.quick_add_exam,
            tone: "purple",
          },
        ]}
      />

      {/* ============ FOOTER STATISTIK ============ */}
      <section className="border-t border-sage-200/60 pt-5">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
          <span className="font-black tabular-nums text-teal-800">
            {classCards.length} {t.stat_classes}
          </span>
          <span className="text-softslate/40">·</span>
          <span className="font-black tabular-nums text-teal-800">
            {totalStudents} {t.stat_students}
          </span>
          <span className="text-softslate/40">·</span>
          <span className="font-black tabular-nums text-teal-800">
            {totalMaterials ?? 0} {t.stat_materials}
          </span>
        </div>
      </section>
    </main>
  );
}

function AttentionRow({
  icon,
  text,
  cta,
  href,
  tone,
}: {
  icon: string;
  text: string;
  cta: string;
  href: string;
  tone: "warm" | "info";
}) {
  const bg =
    tone === "warm"
      ? "bg-terracotta-50 border-terracotta-200/60"
      : "bg-sky-50 border-sky-200/60";

  return (
    <li>
      <Link
        href={href}
        className={`group flex items-center justify-between gap-3 rounded-2xl border ${bg} p-3 transition hover:-translate-y-0.5 hover:shadow-sm`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-base shadow-sm">
            {icon}
          </span>
          <span className="truncate text-sm font-bold text-teal-800">
            {text}
          </span>
        </span>
        <span className="shrink-0 text-xs font-black text-terracotta-600 group-hover:underline">
          {cta} →
        </span>
      </Link>
    </li>
  );
}