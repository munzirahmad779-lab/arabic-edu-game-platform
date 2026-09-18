import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  importAssessment,
  generateAssessmentToken,
  revokeToken,
  togglePublish,
} from "../actions";
import { getLocale } from "@/lib/i18n/server";

type SearchParams = {
  error?: string;
  imported?: string;
  token_created?: string;
};

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const isRtl = locale === "ar";

  const L = {
    back: "Kembali ke Ujian",
    status_published: "Dipublikasikan",
    status_draft: "Draf",
    total_q: "soal",
    total_min: "menit",
    btn_publish: "Publikasikan",
    btn_unpublish: "Batalkan Publikasi",
    btn_ai: "🪄 Generate Soal dengan AI",
    sections_title: "Section Ujian",
    scoring_title: "📊 Cara Penilaian",
    scoring_desc:
      "Sistem penilaian TOEFL Prediction & TOAFL. Setiap section dihitung jumlah benar (raw score), lalu dikonversi ke skor skala 31-68.",
    scoring_how: "Cara Hitung:",
    scoring_step_1:
      "1. Hitung jumlah jawaban benar per section → dapat raw score",
    scoring_step_2:
      "2. Konversi raw score ke skor skala section (31-68)",
    scoring_step_3:
      "3. Total = (Listening + Structure + Reading) ÷ 3 × 10",
    scoring_range:
      "Rentang Total: 310 (rendah) – 677 (sempurna)",
    scoring_scale: "Kategori Skor:",
    scoring_scale_excellent: "600-677 — Excellent",
    scoring_scale_verygood: "550-599 — Very Good",
    scoring_scale_good: "500-549 — Good",
    scoring_scale_fair: "450-499 — Fair",
    scoring_scale_low: "310-449 — Needs Improvement",
    scoring_note:
      "⚠️ Catatan: Konversi yang dipakai adalah pendekatan linier. Skor resmi ETS mungkin sedikit berbeda karena tabel konversi aslinya tidak linier.",
    section_listening: "Listening",
    section_structure: "Structure",
    section_reading: "Reading",
    audio_once: "Audio sekali putar",
    can_review: "Bisa review",
    no_review: "Tidak bisa review",
    import_title: "Impor Soal dari Excel (Alternatif)",
    import_desc:
      "Download template, isi, lalu upload di sini. Akan mengganti semua soal lama.",
    btn_download_template: "⬇️ Download Template",
    btn_upload: "⬆️ Upload & Impor",
    file_label: "File Excel (.xlsx)",
    import_ok: "✓ Impor berhasil.",
    tokens_title: "Token Masuk",
    tokens_desc: "Generate token dan kasih ke siswa. Berlaku 7 hari.",
    btn_generate_token: "🔑 Generate Token Baru",
    token_created_msg: "✓ Token dibuat:",
    token_active: "Aktif",
    token_revoked: "Dicabut",
    token_expired: "Kedaluwarsa",
    token_expires: "Kedaluwarsa",
    token_uses: "pemakaian",
    btn_revoke: "Cabut",
    no_tokens: "Belum ada token.",
    attempts_title: "Percobaan Siswa",
    attempts_desc: "Siswa yang sudah mengerjakan.",
    no_attempts: "Belum ada yang mengerjakan.",
    th_name: "Nama",
    th_started: "Mulai",
    th_finished: "Selesai",
    th_status: "Status",
    th_total: "Total",
    status_in_progress: "Sedang dikerjakan",
    status_completed: "Selesai",
    status_expired: "Kedaluwarsa",
    no_sections_warn: "Tidak ada section. Hapus dan buat ulang ujian ini.",
    client_hint_title: "Bagaimana siswa mulai?",
    client_hint_1: "Generate token",
    client_hint_2: "Kasih ke siswa",
    client_hint_3: "Buka /assessment di device siswa",
    client_hint_4: "Masukkan token & nama, lalu mulai",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: assessmentData } = await db
    .from("assessments")
    .select(
      "id, title, description, assessment_type, level, is_published, total_duration_minutes, total_questions, created_at",
    )
    .eq("id", params.id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!assessmentData) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assessment: any = assessmentData;

  const { data: sectionsData } = await db
    .from("assessment_sections")
    .select(
      "id, section_order, section_type, title, duration_minutes, audio_play_once, allow_review, question_count",
    )
    .eq("assessment_id", assessment.id)
    .order("section_order");

  const { data: tokensData } = await db
    .from("assessment_tokens")
    .select("id, token, expires_at, max_uses, used_count, is_active, created_at")
    .eq("assessment_id", assessment.id)
    .order("created_at", { ascending: false });

  const { data: attemptsData } = await db
    .from("assessment_attempts")
    .select("id, student_name, started_at, finished_at, status, score_total")
    .eq("assessment_id", assessment.id)
    .order("started_at", { ascending: false })
    .limit(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectionList: any[] = sectionsData ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenList: any[] = tokensData ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attemptList: any[] = attemptsData ?? [];

  const now = Date.now();

  return (
    <main className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <Link
          href="/dashboard/assessments"
          className="text-sm font-bold text-teal-700 underline-offset-4 hover:underline"
        >
          ← {L.back}
        </Link>
      </div>

      <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-terracotta-500/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-black sm:text-3xl">
              {assessment.title}
            </h1>
            {assessment.description ? (
              <p className="mt-2 max-w-2xl text-sm text-white/85">
                {assessment.description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-3 py-1 font-bold backdrop-blur">
                {String(assessment.assessment_type).toUpperCase()}
              </span>
              {assessment.level ? (
                <span className="rounded-full bg-white/15 px-3 py-1 font-bold backdrop-blur">
                  {assessment.level}
                </span>
              ) : null}
              <span className="rounded-full bg-white/15 px-3 py-1 font-bold backdrop-blur">
                {assessment.total_questions} {L.total_q}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 font-bold backdrop-blur">
                {assessment.total_duration_minutes} {L.total_min}
              </span>
              <span
                className={`rounded-full px-3 py-1 font-black ${
                  assessment.is_published
                    ? "bg-sage-500 text-white"
                    : "bg-terracotta-500 text-white"
                }`}
              >
                {assessment.is_published
                  ? L.status_published
                  : L.status_draft}
              </span>
            </div>
          </div>

          <form action={togglePublish}>
            <input type="hidden" name="assessment_id" value={assessment.id} />
            <input
              type="hidden"
              name="next"
              value={assessment.is_published ? "false" : "true"}
            />
            <button
              type="submit"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-teal-700 shadow-md transition hover:-translate-y-0.5"
            >
              {assessment.is_published ? L.btn_unpublish : L.btn_publish}
            </button>
          </form>
        </div>
      </header>

      <Link
        href={`/dashboard/assessments/${assessment.id}/ai`}
        className="flex items-center gap-4 rounded-[2rem] border-2 border-terracotta-500/40 bg-gradient-to-br from-terracotta-500 to-terracotta-600 p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur">
          🪄
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-black">{L.btn_ai}</h2>
          <p className="mt-0.5 text-xs text-white/85">
            Buat soal baru dari nol, atau paste draft soal Anda untuk
            dirapikan otomatis.
          </p>
        </div>
        <span className="text-2xl">→</span>
      </Link>

      {searchParams.imported === "1" ? (
        <div className="rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm font-bold text-sage-600">
          {L.import_ok}
        </div>
      ) : null}

      {searchParams.token_created ? (
        <div className="rounded-2xl border border-terracotta-500/30 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-600">
          {L.token_created_msg}{" "}
          <span className="font-mono text-lg font-black">
            {searchParams.token_created}
          </span>
        </div>
      ) : null}

      {searchParams.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      <section className="aesthetic-card">
        <h2 className="font-display text-lg font-black text-teal-700">
          {L.sections_title}
        </h2>

        {sectionList.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {L.no_sections_warn}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {sectionList.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-sage-200/60 bg-white p-4"
              >
                <p className="text-xs font-black uppercase tracking-wider text-terracotta-500">
                  {s.section_type === "listening"
                    ? L.section_listening
                    : s.section_type === "structure"
                      ? L.section_structure
                      : L.section_reading}
                </p>
                <h3 className="mt-1 text-base font-black text-teal-700">
                  {s.title}
                </h3>
                <p className="mt-1 text-xs text-softslate/70">
                  {s.question_count} {L.total_q} · {s.duration_minutes}{" "}
                  {L.total_min}
                </p>
                <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                  {s.audio_play_once ? (
                    <span className="rounded-full bg-terracotta-100 px-2 py-0.5 font-bold text-terracotta-600">
                      {L.audio_once}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold ${
                      s.allow_review
                        ? "bg-sage-100 text-sage-600"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {s.allow_review ? L.can_review : L.no_review}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CARA PENILAIAN */}
      <section className="aesthetic-card border-2 border-teal-500/20 bg-teal-50/30">
        <h2 className="font-display text-lg font-black text-teal-700">
          {L.scoring_title}
        </h2>
        <p className="mt-1 text-sm text-softslate/80">{L.scoring_desc}</p>

        <div className="mt-4 rounded-2xl border border-sage-200/60 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wider text-terracotta-500">
            {L.scoring_how}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-softslate">
            <li>{L.scoring_step_1}</li>
            <li>{L.scoring_step_2}</li>
            <li className="font-bold text-teal-700">{L.scoring_step_3}</li>
          </ul>
          <p className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700">
            {L.scoring_range}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-sage-200/60 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wider text-terracotta-500">
            {L.scoring_scale}
          </p>
          <div className="mt-2 space-y-1 text-xs text-softslate">
            <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
              <span>{L.scoring_scale_excellent.split(" — ")[0]}</span>
              <span className="font-black text-sage-600">
                {L.scoring_scale_excellent.split(" — ")[1]}
              </span>
            </div>
            <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
              <span>{L.scoring_scale_verygood.split(" — ")[0]}</span>
              <span className="font-black text-teal-700">
                {L.scoring_scale_verygood.split(" — ")[1]}
              </span>
            </div>
            <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
              <span>{L.scoring_scale_good.split(" — ")[0]}</span>
              <span className="font-black text-terracotta-500">
                {L.scoring_scale_good.split(" — ")[1]}
              </span>
            </div>
            <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
              <span>{L.scoring_scale_fair.split(" — ")[0]}</span>
              <span className="font-black text-terracotta-600">
                {L.scoring_scale_fair.split(" — ")[1]}
              </span>
            </div>
            <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
              <span>{L.scoring_scale_low.split(" — ")[0]}</span>
              <span className="font-black text-softslate">
                {L.scoring_scale_low.split(" — ")[1]}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 rounded-2xl border border-terracotta-500/30 bg-terracotta-50 p-3 text-xs text-terracotta-700">
          {L.scoring_note}
        </p>
      </section>

      <section className="aesthetic-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-teal-700">
              {L.import_title}
            </h2>
            <p className="mt-1 text-sm text-softslate/70">{L.import_desc}</p>
          </div>
          <a
            href={`/api/assessments/template?type=${assessment.assessment_type}`}
            download
            className="rounded-full border border-sage-200 bg-white px-4 py-2 text-xs font-bold text-teal-700 transition hover:bg-sage-50"
          >
            {L.btn_download_template}
          </a>
        </div>

        <form action={importAssessment} className="mt-4 space-y-3">
          <input type="hidden" name="assessment_id" value={assessment.id} />
          <div className="rounded-2xl border-2 border-dashed border-sage-200 bg-sage-50/40 p-5">
            <label
              htmlFor="excel_file"
              className="block text-sm font-bold text-teal-700"
            >
              {L.file_label}
            </label>
            <input
              id="excel_file"
              name="excel_file"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              required
              className="mt-2 block w-full cursor-pointer rounded-xl border border-sage-200 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-terracotta-500 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-terracotta-600"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            {L.btn_upload}
          </button>
        </form>
      </section>

      <section className="aesthetic-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-teal-700">
              {L.tokens_title}
            </h2>
            <p className="mt-1 text-sm text-softslate/70">{L.tokens_desc}</p>
          </div>
          <form action={generateAssessmentToken}>
            <input type="hidden" name="assessment_id" value={assessment.id} />
            <button type="submit" className="btn-primary">
              {L.btn_generate_token}
            </button>
          </form>
        </div>

        {tokenList.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-sage-200 bg-sage-50/40 p-5 text-center text-sm text-softslate/70">
            {L.no_tokens}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {tokenList.map((tk) => {
              const isExpired = new Date(tk.expires_at).getTime() < now;
              const isActive = tk.is_active && !isExpired;
              const statusLabel = isExpired
                ? L.token_expired
                : tk.is_active
                  ? L.token_active
                  : L.token_revoked;
              const statusColor = isExpired
                ? "bg-red-100 text-red-700"
                : tk.is_active
                  ? "bg-sage-100 text-sage-600"
                  : "bg-softslate/10 text-softslate";

              return (
                <div
                  key={tk.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sage-200/60 bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-black tracking-wider text-teal-700">
                      {tk.token}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-softslate/70">
                    <span>
                      {L.token_expires}:{" "}
                      {new Date(tk.expires_at).toLocaleDateString(
                        locale === "ar" ? "ar-EG" : locale,
                      )}
                    </span>
                    <span>
                      {tk.used_count}/{tk.max_uses} {L.token_uses}
                    </span>
                    {isActive ? (
                      <form action={revokeToken}>
                        <input type="hidden" name="token_id" value={tk.id} />
                        <input
                          type="hidden"
                          name="assessment_id"
                          value={assessment.id}
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 transition hover:bg-red-100"
                        >
                          {L.btn_revoke}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-teal-500/20 bg-teal-50 p-4 text-xs text-teal-700">
          <p className="font-black">{L.client_hint_title}</p>
          <ol className="mt-2 list-decimal space-y-1 ps-5">
            <li>{L.client_hint_1}</li>
            <li>{L.client_hint_2}</li>
            <li>
              <span dir="ltr" className="font-mono">
                /assessment
              </span>{" "}
              — {L.client_hint_3}
            </li>
            <li>{L.client_hint_4}</li>
          </ol>
        </div>
      </section>

      <section className="aesthetic-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-teal-700">
              {L.attempts_title}
            </h2>
            <p className="mt-1 text-sm text-softslate/70">{L.attempts_desc}</p>
          </div>
        </div>

        {attemptList.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-sage-200 bg-sage-50/40 p-5 text-center text-sm text-softslate/70">
            {L.no_attempts}
          </div>
        ) : (
          <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-sage-200/60">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-sage-50">
                <tr className="text-xs text-teal-700">
                  <th className="px-3 py-2 text-start font-bold">
                    {L.th_name}
                  </th>
                  <th className="px-3 py-2 text-start font-bold">
                    {L.th_started}
                  </th>
                  <th className="px-3 py-2 text-start font-bold">
                    {L.th_finished}
                  </th>
                  <th className="px-3 py-2 text-start font-bold">
                    {L.th_status}
                  </th>
                  <th className="px-3 py-2 text-start font-bold">
                    {L.th_total}
                  </th>
                </tr>
              </thead>
              <tbody>
                {attemptList.map((at) => (
                  <tr
                    key={at.id}
                    className="border-t border-sage-200/60 bg-white"
                  >
                    <td className="px-3 py-2 font-bold text-teal-700">
                      {at.student_name}
                    </td>
                    <td className="px-3 py-2 text-xs text-softslate/70">
                      {new Date(at.started_at).toLocaleString(
                        locale === "ar" ? "ar-EG" : locale,
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-softslate/70">
                      {at.finished_at
                        ? new Date(at.finished_at).toLocaleString(
                            locale === "ar" ? "ar-EG" : locale,
                          )
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          at.status === "completed"
                            ? "bg-sage-100 text-sage-600"
                            : at.status === "expired"
                              ? "bg-red-100 text-red-700"
                              : "bg-terracotta-100 text-terracotta-600"
                        }`}
                      >
                        {at.status === "completed"
                          ? L.status_completed
                          : at.status === "expired"
                            ? L.status_expired
                            : L.status_in_progress}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono font-black text-terracotta-600">
                      {at.score_total ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}