import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";
import { logoutStudent } from "./actions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LanguageSwitcher } from "@/components/language-switcher";

function fmt(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export default async function StudentDashboardPage() {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const th = dict.student_home;

  const supabase = await createClient();
  const { data: materials } = await supabase.rpc("student_list_materials", {
    p_token: token,
    p_class_id: session.class_id,
  });

  const list = materials ?? [];

  return (
    <main
      className="min-h-screen bg-warmwhite"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* ============ TOP BAR ============ */}
      <header className="sticky top-0 z-20 border-b border-sage-200/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/student"
            className="flex items-center"
            aria-label={dict.common.brand_main}
          >
            <Image
              src="/logo-horizontal.png"
              alt={dict.common.brand_main}
              width={180}
              height={80}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher current={locale} />
            <span
              className="hidden max-w-[140px] truncate text-sm font-bold text-softslate/80 sm:inline"
              dir="ltr"
            >
              {session.name}
            </span>
            <form action={logoutStudent}>
              <button
                type="submit"
                className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 sm:text-sm"
              >
                {th.logout}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* ============ HERO ============ */}
        <section className="rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/75">
                {dict.login_student.portal_title}
              </p>
              <h1 className="font-display mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">
                {fmt(th.welcome_title, { name: session.name })}
              </h1>
              <p className="mt-1.5 text-sm text-white/85">
                {th.welcome_subtitle}
              </p>
            </div>
            <div className="rounded-2xl bg-white/20 px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/85">
                {dict.student.class_label}
              </p>
              <p className="mt-1 max-w-[160px] truncate text-sm font-black text-white">
                {session.class_name}
              </p>
            </div>
          </div>
        </section>

        {/* ============ KARTU UJIAN ============ */}
        <Link
          href="/assessment"
          className="group flex items-center gap-4 rounded-[2rem] border-2 border-terracotta-500/40 bg-gradient-to-br from-terracotta-500 to-terracotta-600 p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur">
            📝
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-black">
              {th.exam_card_title}
            </h2>
            <p className="mt-0.5 text-xs text-white/85">{th.exam_card_desc}</p>
          </div>
          <span className="text-2xl">{isRtl ? "←" : "→"}</span>
        </Link>

        {/* ============ 3 KARTU NAVIGASI ============ */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/student/practice"
            className="aesthetic-card group flex flex-col gap-3 transition hover:-translate-y-1 hover:shadow-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta-500 text-2xl text-white shadow-md transition group-hover:scale-110">
              🎯
            </span>
            <div>
              <h2 className="font-display text-lg font-black text-teal-800">
                {th.card_practice_title}
              </h2>
              <p className="mt-1 text-xs leading-6 text-softslate/80">
                {th.card_practice_desc}
              </p>
            </div>
            <span className="mt-auto text-xs font-black text-terracotta-600">
              {dict.student.card_practice_cta}
            </span>
          </Link>

          <Link
            href="/student/essay"
            className="aesthetic-card group flex flex-col gap-3 transition hover:-translate-y-1 hover:shadow-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-2xl text-white shadow-md transition group-hover:scale-110">
              ✍️
            </span>
            <div>
              <h2 className="font-display text-lg font-black text-teal-800">
                {th.card_essay_title}
              </h2>
              <p className="mt-1 text-xs leading-6 text-softslate/80">
                {th.card_essay_desc}
              </p>
            </div>
            <span className="mt-auto text-xs font-black text-teal-600">
              {dict.student.card_essay_cta}
            </span>
          </Link>

          <Link
            href="/join"
            className="aesthetic-card group flex flex-col gap-3 transition hover:-translate-y-1 hover:shadow-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-500 text-2xl text-white shadow-md transition group-hover:scale-110">
              🎮
            </span>
            <div>
              <h2 className="font-display text-lg font-black text-teal-800">
                {th.card_guided_title}
              </h2>
              <p className="mt-1 text-xs leading-6 text-softslate/80">
                {th.card_guided_desc}
              </p>
            </div>
            <span className="mt-auto text-xs font-black text-sage-600">
              {dict.student.card_guided_cta}
            </span>
          </Link>
        </section>

        {/* ============ MATERI ============ */}
        <section className="rounded-[2rem] border border-sage-200/60 bg-white p-5 shadow-md sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-black text-teal-800">
              {th.materials_title}
            </h2>
            <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-bold text-terracotta-600">
              {list.length} {th.materials_count_suffix}
            </span>
          </div>

          {list.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-sage-200 bg-sage-50/40 py-12 text-center">
              <div className="text-5xl">📭</div>
              <p className="mt-4 text-sm text-softslate/70">
                {th.materials_empty}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((m, index) => (
                <li key={m.id}>
                  <Link
                    href={`/student/materials/${m.id}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-sage-200/60 bg-white p-4 transition hover:border-terracotta-500/50 hover:bg-terracotta-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta-100 text-lg font-bold text-terracotta-600">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-bold text-teal-800 group-hover:text-terracotta-600">
                          {m.title}
                        </p>
                        <p className="text-xs text-softslate/70">
                          {th.materials_updated}{" "}
                          {new Date(m.updated_at).toISOString().slice(0, 10)}
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl text-sage-500 transition group-hover:text-terracotta-500">
                      {isRtl ? "←" : "→"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}