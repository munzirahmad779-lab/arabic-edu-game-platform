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

type ActiveStudent = {
  id: string;
  name: string;
  className: string;
  loginCount: number;
  practiceCount: number;
  essayCount: number;
  lastSeen: string | null;
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
  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));

  const studentCounts = new Map<string, number>();
  let totalStudents = 0;

  const allStudents: Array<{
    id: string;
    name: string;
    class_id: string;
  }> = [];

  if (classIds.length > 0) {
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, name, class_id")
      .in("class_id", classIds);

    for (const s of studentRows ?? []) {
      studentCounts.set(s.class_id, (studentCounts.get(s.class_id) ?? 0) + 1);
      totalStudents += 1;
      allStudents.push(s);
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
  // SISWA BELAJAR MINGGU INI
  // ============================================================
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const iso7 = sevenDaysAgo.toISOString();

  const studentIds = allStudents.map((s) => s.id);

  // Login count (dari student_sessions)
  const loginMap = new Map<string, { count: number; last: string | null }>();
  const practiceMap = new Map<string, number>();
  const essayMap = new Map<string, number>();

  if (studentIds.length > 0) {
    const [sessionsRes, practiceRes, essayRes] = await Promise.all([
      db
        .from("student_sessions")
        .select("student_id, last_seen_at")
        .in("student_id", studentIds)
        .gte("last_seen_at", iso7),
      db
        .from("student_practice_answers")
        .select("student_id")
        .in("student_id", studentIds)
        .gte("answered_at", iso7),
      db
        .from("essay_submissions")
        .select("student_id")
        .in("student_id", studentIds)
        .gte("submitted_at", iso7),
    ]);

    for (const s of sessionsRes.data ?? []) {
      const prev = loginMap.get(s.student_id);
      const last = s.last_seen_at;
      const cur = prev?.last ?? null;
      const newLast =
        !cur || (last && new Date(last) > new Date(cur)) ? last : cur;
      loginMap.set(s.student_id, {
        count: (prev?.count ?? 0) + 1,
        last: newLast,
      });
    }

    for (const p of practiceRes.data ?? []) {
      practiceMap.set(p.student_id, (practiceMap.get(p.student_id) ?? 0) + 1);
    }

    for (const e of essayRes.data ?? []) {
      essayMap.set(e.student_id, (essayMap.get(e.student_id) ?? 0) + 1);
    }
  }

  const activeStudents: ActiveStudent[] = [];
  for (const s of allStudents) {
    const logins = loginMap.get(s.id)?.count ?? 0;
    const practices = practiceMap.get(s.id) ?? 0;
    const essays = essayMap.get(s.id) ?? 0;
    if (logins === 0 && practices === 0 && essays === 0) continue;

    const cls = classMap.get(s.class_id);
    activeStudents.push({
      id: s.id,
      name: s.name,
      className: cls?.name ?? "",
      loginCount: logins,
      practiceCount: practices,
      essayCount: essays,
      lastSeen: loginMap.get(s.id)?.last ?? null,
    });
  }

  // Sortir: paling banyak aktivitas di atas
  activeStudents.sort(
    (a, b) =>
      b.practiceCount +
      b.essayCount +
      b.loginCount -
      (a.practiceCount + a.essayCount + a.loginCount),
  );

  const activeCount = activeStudents.length;
  const inactiveCount = totalStudents - activeCount;

  // ============================================================
  // AKTIVITAS TERAKHIR (timeline guru)
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
      {/* LOGO */}
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

      {/* HERO */}
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

      {/* QUICK LAUNCHER: MODE PROYEKTOR KELAS & REMOTE HP */}
      <section className="rounded-[2rem] bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black backdrop-blur-sm">
              <span>📽️</span>
              <span>KONSOL KELAS & SMARTBOARD</span>
            </div>
            <h2 className="mt-2 text-xl sm:text-2xl font-black">
              Mode Proyektor & Remote HP Nirkabel Siswa
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-emerald-100 max-w-xl">
              Ubah layar kelas menjadi arena interaktif 4 tim. Siswa bermain dari bangku masing-masing menggunakan HP sebagai stik kontroler (A, B, C, D) dengan bonus kecepatan!
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/games"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-900 shadow-lg hover:bg-emerald-50 transition"
            >
              <span>📽️</span>
              <span>Pilih Game & Buka Proyektor</span>
            </Link>
            <a
              href="/controller"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-950/60 border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-950/90 transition"
            >
              <span>📱</span>
              <span>Buka Stik HP Siswa (/controller)</span>
            </a>
          </div>
        </div>
      </section>

      {/* KELAS SAYA */}
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

      {/* SISWA BELAJAR MINGGU INI */}
      <section className="rounded-[2rem] border border-sage-200/60 bg-white p-5 shadow-md sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-teal-800">
              {isRtl
                ? "🎓 الطلاب النشطون هذا الأسبوع"
                : locale === "en"
                  ? "🎓 Active Students This Week"
                  : "🎓 Siswa Belajar Minggu Ini"}
            </h2>
            <p className="mt-0.5 text-xs text-softslate/70">
              {isRtl
                ? "الطلاب الذين سجّلوا الدخول أو تدرّبوا أو سلّموا مقالًا"
                : locale === "en"
                  ? "Students who logged in, practiced, or submitted essays"
                  : "Siswa yang login, latihan, atau kumpul essay"}
            </p>
          </div>

          <div className="flex gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
              ✓ {activeCount}{" "}
              {isRtl ? "نشط" : locale === "en" ? "active" : "aktif"}
            </span>
            {inactiveCount > 0 ? (
              <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-softslate">
                {inactiveCount}{" "}
                {isRtl ? "غير نشط" : locale === "en" ? "inactive" : "belum"}
              </span>
            ) : null}
          </div>
        </div>

        {activeStudents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sage-200 bg-sage-50/40 p-8 text-center">
            <div className="text-4xl">💤</div>
            <p className="mt-3 text-sm font-bold text-teal-700">
              {isRtl
                ? "لم يسجّل أي طالب نشاطًا هذا الأسبوع"
                : locale === "en"
                  ? "No student activity this week"
                  : "Belum ada aktivitas siswa minggu ini"}
            </p>
            <p className="mt-1 text-xs text-softslate/70">
              {isRtl
                ? "شارك رابط بوابة الطالب ليبدأوا."
                : locale === "en"
                  ? "Share the student portal link to get them started."
                  : "Bagikan link portal siswa agar mereka mulai belajar."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {activeStudents.slice(0, 6).map((s, i) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sage-200/60 bg-white p-3.5 transition hover:border-terracotta-300 hover:bg-terracotta-50/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white ${DOT_COLORS[i % DOT_COLORS.length]}`}
                  >
                    {s.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black text-teal-800">
                      {s.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-softslate/70">
                      {s.className}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {s.loginCount > 0 ? (
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 font-bold text-sky-700">
                      🔑{" "}
                      {isRtl
                        ? `دخول × ${s.loginCount}`
                        : locale === "en"
                          ? `${s.loginCount}× login`
                          : `login × ${s.loginCount}`}
                    </span>
                  ) : null}
                  {s.practiceCount > 0 ? (
                    <span className="rounded-full bg-terracotta-100 px-2.5 py-1 font-bold text-terracotta-700">
                      🎯{" "}
                      {isRtl
                        ? `تدريب × ${s.practiceCount}`
                        : locale === "en"
                          ? `${s.practiceCount}× practice`
                          : `latihan × ${s.practiceCount}`}
                    </span>
                  ) : null}
                  {s.essayCount > 0 ? (
                    <span className="rounded-full bg-teal-100 px-2.5 py-1 font-bold text-teal-700">
                      ✍️{" "}
                      {isRtl
                        ? `مقال × ${s.essayCount}`
                        : locale === "en"
                          ? `${s.essayCount}× essay`
                          : `essay × ${s.essayCount}`}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}

            {activeStudents.length > 6 ? (
              <li className="pt-1 text-center text-xs text-softslate/70">
                {isRtl
                  ? `+ ${activeStudents.length - 6} طلاب آخرين`
                  : locale === "en"
                    ? `+ ${activeStudents.length - 6} more students`
                    : `+ ${activeStudents.length - 6} siswa lain`}
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {/* PERLU PERHATIAN + AKTIVITAS */}
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

      {/* AKSI CEPAT */}
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

      {/* FOOTER STATISTIK */}
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