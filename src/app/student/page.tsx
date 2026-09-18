import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";
import { logoutStudent } from "./actions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function StudentDashboardPage() {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const t = dict.student;

  const supabase = await createClient();
  const { data: materials } = await supabase.rpc("student_list_materials", {
    p_token: token,
    p_class_id: session.class_id,
  });

  const list = materials ?? [];

  return (
    <main
      className="min-h-screen bg-warmwhite p-4 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="aesthetic-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-terracotta-500">
              {t.portal_label}
            </p>
            <h1 className="font-display mt-1 text-2xl font-black text-teal-700 sm:text-3xl">
              {t.greet} {session.name}
            </h1>
            <p className="mt-1 text-sm text-softslate/80">
              {t.class_label}{" "}
              <span className="font-bold text-teal-700">
                {session.class_name}
              </span>
            </p>
          </div>
          <form action={logoutStudent}>
            <button
              type="submit"
              className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
            >
              {t.logout}
            </button>
          </form>
        </header>

        {/* KARTU IKUT UJIAN — HIGHLIGHT */}
        <Link
          href="/assessment"
          className="group flex items-center gap-4 rounded-[2rem] border-2 border-terracotta-500/40 bg-gradient-to-br from-terracotta-500 to-terracotta-600 p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur">
            📝
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-black">
              Ikut Ujian TOEFL / TOAFL
            </h2>
            <p className="mt-0.5 text-xs text-white/85">
              Punya token dari guru? Masukkan di sini untuk kerjakan ujian.
            </p>
          </div>
          <span className="text-2xl">→</span>
        </Link>

        <section className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/student/practice"
            className="aesthetic-card group flex flex-col gap-3"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta-500 text-2xl text-white shadow-md transition group-hover:scale-110">
              🎯
            </span>
            <div>
              <h2 className="font-display text-lg font-black text-teal-700">
                {t.card_practice_title}
              </h2>
              <p className="mt-1 text-xs leading-6 text-softslate/80">
                {t.card_practice_desc}
              </p>
            </div>
            <span className="mt-auto text-xs font-black text-terracotta-600">
              {t.card_practice_cta}
            </span>
          </Link>

          <Link
            href="/student/essay"
            className="aesthetic-card group flex flex-col gap-3"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-2xl text-white shadow-md transition group-hover:scale-110">
              ✍️
            </span>
            <div>
              <h2 className="font-display text-lg font-black text-teal-700">
                {t.card_essay_title}
              </h2>
              <p className="mt-1 text-xs leading-6 text-softslate/80">
                {t.card_essay_desc}
              </p>
            </div>
            <span className="mt-auto text-xs font-black text-teal-600">
              {t.card_essay_cta}
            </span>
          </Link>

          <Link
            href="/join"
            className="aesthetic-card group flex flex-col gap-3"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-500 text-2xl text-white shadow-md transition group-hover:scale-110">
              🏆
            </span>
            <div>
              <h2 className="font-display text-lg font-black text-teal-700">
                {t.card_guided_title}
              </h2>
              <p className="mt-1 text-xs leading-6 text-softslate/80">
                {t.card_guided_desc}
              </p>
            </div>
            <span className="mt-auto text-xs font-black text-sage-600">
              {t.card_guided_cta}
            </span>
          </Link>
        </section>

        <section className="aesthetic-card">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-black text-teal-700">
              {t.materials_title}
            </h2>
            <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-bold text-terracotta-600">
              {list.length} {t.materials_count_suffix}
            </span>
          </div>

          {list.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-sage-200 bg-sage-50/40 py-12 text-center">
              <div className="text-5xl">📭</div>
              <p className="mt-4 text-sm text-softslate/70">
                {t.materials_empty}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/student/materials/${m.id}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-sage-200/60 bg-white p-4 transition hover:border-terracotta-500/50 hover:bg-terracotta-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta-100 text-lg font-bold text-terracotta-600">
                        {m.position}
                      </span>
                      <div>
                        <p className="font-bold text-teal-700 group-hover:text-terracotta-600">
                          {m.title}
                        </p>
                        <p className="text-xs text-softslate/70">
                          {t.materials_updated_prefix}{" "}
                          {new Date(m.updated_at).toISOString().slice(0, 10)}
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl text-sage-500 transition group-hover:text-terracotta-500">
                      ←
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