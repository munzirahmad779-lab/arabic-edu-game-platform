import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAssessment, deleteAssessment } from "./actions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SearchParams = {
  error?: string;
  deleted?: string;
};

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";

  const L = {
    title: "Ujian TOEFL / TOAFL",
    subtitle:
      "Buat simulasi TOEFL ITP atau TOAFL dengan 3 section (Listening, Structure, Reading), timer penuh, dan masuk pakai token.",
    create_title: "Buat Ujian Baru",
    label_title: "Judul Ujian",
    placeholder_title: "Contoh: TOEFL ITP Prediction - November 2026",
    label_type: "Tipe Ujian",
    type_toefl: "TOEFL ITP",
    type_toafl: "TOAFL",
    type_custom: "Custom",
    label_level: "Level (opsional)",
    placeholder_level: "Contoh: Level 1",
    label_desc: "Deskripsi (opsional)",
    placeholder_desc: "Deskripsi singkat",
    btn_create: "Buat Ujian (otomatis 3 section)",
    my_tests: "Ujian Saya",
    tests_count: "ujian",
    empty: "Belum ada ujian. Buat yang pertama.",
    status_published: "Dipublikasikan",
    status_draft: "Draf",
    questions_unit: "soal",
    minutes_unit: "menit",
    open: "Buka",
    delete: "Hapus",
    deleted_ok: "✓ Berhasil dihapus.",
    err_invalid_title: "Judul tidak valid (1-200 karakter).",
    err_invalid_type: "Tipe tidak valid.",
    back: "Dashboard",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: assessmentsData } = await db
    .from("assessments")
    .select(
      "id, title, description, assessment_type, level, is_published, total_duration_minutes, total_questions, created_at",
    )
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = assessmentsData ?? [];

  const errorMsg = (() => {
    if (searchParams.error === "invalid_title") return L.err_invalid_title;
    if (searchParams.error === "invalid_type") return L.err_invalid_type;
    if (searchParams.error) return searchParams.error;
    return null;
  })();

  return (
    <main className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-terracotta-500">
            {dict.common.brand_top}
          </p>
          <h1 className="font-display mt-1 text-3xl font-black tracking-tight text-teal-700">
            {L.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-softslate/80">
            {L.subtitle}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 transition hover:bg-sage-50"
        >
          {L.back}
        </Link>
      </header>

      {searchParams.deleted === "1" ? (
        <div className="rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-600">
          {L.deleted_ok}
        </div>
      ) : null}

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      ) : null}

      <section className="aesthetic-card">
        <h2 className="font-display text-lg font-black text-teal-700">
          {L.create_title}
        </h2>

        <form
          action={createAssessment}
          className="mt-5 grid gap-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label
              htmlFor="title"
              className="block text-sm font-bold text-teal-700"
            >
              {L.label_title}
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={200}
              placeholder={L.placeholder_title}
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
            />
          </div>

          <div>
            <label
              htmlFor="assessment_type"
              className="block text-sm font-bold text-teal-700"
            >
              {L.label_type}
            </label>
            <select
              id="assessment_type"
              name="assessment_type"
              defaultValue="toefl_itp"
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="toefl_itp">{L.type_toefl}</option>
              <option value="toafl">{L.type_toafl}</option>
              <option value="custom">{L.type_custom}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="level"
              className="block text-sm font-bold text-teal-700"
            >
              {L.label_level}
            </label>
            <input
              id="level"
              name="level"
              type="text"
              maxLength={50}
              placeholder={L.placeholder_level}
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="description"
              className="block text-sm font-bold text-teal-700"
            >
              {L.label_desc}
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              maxLength={500}
              placeholder={L.placeholder_desc}
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
            />
          </div>

          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary w-full">
              {L.btn_create}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-black text-teal-700">
            {L.my_tests}
          </h2>
          <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-bold text-terracotta-600">
            {list.length} {L.tests_count}
          </span>
        </div>

        {list.length === 0 ? (
          <div className="aesthetic-card text-center text-sm text-softslate/70">
            {L.empty}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a) => (
              <article key={a.id} className="aesthetic-card flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-black text-teal-700">
                    {a.title}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                      a.is_published
                        ? "bg-sage-100 text-sage-600"
                        : "bg-terracotta-100 text-terracotta-600"
                    }`}
                  >
                    {a.is_published ? L.status_published : L.status_draft}
                  </span>
                </div>

                {a.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-softslate/70">
                    {a.description}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-terracotta-100 px-2 py-1 font-bold text-terracotta-600">
                    {String(a.assessment_type).toUpperCase()}
                  </span>
                  {a.level ? (
                    <span className="rounded-full bg-teal-100 px-2 py-1 font-bold text-teal-700">
                      {a.level}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-sage-100 px-2 py-1 font-bold text-sage-600">
                    {a.total_questions} {L.questions_unit}
                  </span>
                  <span className="rounded-full bg-sage-100 px-2 py-1 font-bold text-sage-600">
                    {a.total_duration_minutes} {L.minutes_unit}
                  </span>
                </div>

                <div className="mt-4 flex gap-2 pt-2">
                  <Link
                    href={`/dashboard/assessments/${a.id}`}
                    className="flex-1 rounded-full bg-terracotta-500 px-4 py-2.5 text-center text-sm font-black text-white transition hover:bg-terracotta-600"
                  >
                    {L.open}
                  </Link>
                  <form action={deleteAssessment}>
                    <input type="hidden" name="assessment_id" value={a.id} />
                    <button
                      type="submit"
                      title={L.delete}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                    >
                      🗑
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}