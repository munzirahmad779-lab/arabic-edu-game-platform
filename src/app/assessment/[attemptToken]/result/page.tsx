import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ResultPage({
  params,
}: {
  params: { attemptToken: string };
}) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: attempt } = await db
    .from("assessment_attempts")
    .select(
      "id, attempt_token, assessment_id, student_name, status, started_at, finished_at, raw_listening, raw_structure, raw_reading, score_listening, score_structure, score_reading, score_total",
    )
    .eq("attempt_token", params.attemptToken)
    .maybeSingle();

  if (!attempt) notFound();

  const { data: assessment } = await db
    .from("assessments")
    .select("id, title, assessment_type, level")
    .eq("id", attempt.assessment_id)
    .maybeSingle();

  if (!assessment) notFound();

  const isCompleted = attempt.status === "completed";

  const l = attempt.score_listening ?? 0;
  const s = attempt.score_structure ?? 0;
  const r = attempt.score_reading ?? 0;
  const total = attempt.score_total ?? 0;

  const scoreLabel = (v: number) =>
    v >= 600
      ? "Excellent"
      : v >= 550
        ? "Very Good"
        : v >= 500
          ? "Good"
          : v >= 450
            ? "Fair"
            : "Needs Improvement";

  return (
    <main className="min-h-screen bg-warmwhite p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6 py-8">
        <div className="text-center">
          <p className="text-xs font-bold text-terracotta-500">Hasil Ujian</p>
          <h1 className="font-display mt-1 text-3xl font-black text-teal-700">
            {assessment.title}
          </h1>
          <p className="mt-2 text-sm text-softslate/70">
            {attempt.student_name}
          </p>
        </div>

        {!isCompleted ? (
          <div className="rounded-2xl border border-terracotta-500/30 bg-terracotta-50 p-6 text-center">
            <p className="text-sm font-bold text-terracotta-600">
              Ujian belum selesai. Kembali ke halaman ujian untuk melanjutkan.
            </p>
            <Link
              href={`/assessment/${params.attemptToken}`}
              className="btn-primary mt-4"
            >
              Lanjutkan Ujian
            </Link>
          </div>
        ) : (
          <>
            <section className="rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-700 p-8 text-center text-white shadow-2xl">
              <p className="text-xs font-bold text-white/70">
                Skor Total TOEFL Prediction
              </p>
              <div className="mt-3 text-7xl font-black tabular-nums">
                {total}
              </div>
              <p className="mt-2 text-sm text-white/80">
                dari 677 · {scoreLabel(total)}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs text-white/70">Listening</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{l}</p>
                  <p className="text-[10px] text-white/60">
                    {attempt.raw_listening ?? 0} benar
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs text-white/70">Structure</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{s}</p>
                  <p className="text-[10px] text-white/60">
                    {attempt.raw_structure ?? 0} benar
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs text-white/70">Reading</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{r}</p>
                  <p className="text-[10px] text-white/60">
                    {attempt.raw_reading ?? 0} benar
                  </p>
                </div>
              </div>
            </section>

            <section className="aesthetic-card">
              <h2 className="font-display text-lg font-black text-teal-700">
                📊 Skala Referensi TOEFL ITP
              </h2>
              <div className="mt-3 space-y-1 text-xs text-softslate">
                <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
                  <span>600–677</span>
                  <span className="font-black text-sage-600">Excellent</span>
                </div>
                <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
                  <span>550–597</span>
                  <span className="font-black text-teal-700">Very Good</span>
                </div>
                <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
                  <span>500–547</span>
                  <span className="font-black text-terracotta-500">Good</span>
                </div>
                <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
                  <span>450–497</span>
                  <span className="font-black text-terracotta-600">Fair</span>
                </div>
                <div className="flex justify-between rounded-lg px-3 py-1.5 even:bg-sage-50">
                  <span>310–447</span>
                  <span className="font-black text-softslate">
                    Needs Improvement
                  </span>
                </div>
              </div>
            </section>

            <section className="aesthetic-card text-xs text-softslate">
              <p>
                <b className="text-teal-700">Mulai:</b>{" "}
                {new Date(attempt.started_at).toLocaleString("id-ID")}
              </p>
              {attempt.finished_at ? (
                <p className="mt-1">
                  <b className="text-teal-700">Selesai:</b>{" "}
                  {new Date(attempt.finished_at).toLocaleString("id-ID")}
                </p>
              ) : null}
            </section>
          </>
        )}

        <div className="text-center">
          <Link
            href="/"
            className="text-xs font-bold text-teal-700 underline-offset-4 hover:underline"
          >
            ← Kembali ke Halaman Utama
          </Link>
        </div>
      </div>
    </main>
  );
}