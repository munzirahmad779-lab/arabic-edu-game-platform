import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { kosakataDars } from "@/modules/tugas-susulan/kosakata";
import { qawaidDars } from "@/modules/tugas-susulan/qawaid";
import { TugasCard, type TugasCardData } from "./tugas-card";

export default async function StudentTugasSusulanPage() {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const locale = await getLocale();
  const isRtl = locale === "ar";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_get_catchup_tasks", {
    p_token: token,
  });

  if (error) {
    console.error("[StudentTugasSusulanPage]", error);
  }

  const allRows: TugasCardData[] = (data ?? []).map((t) => {
    const meta = kosakataDars(t.dars_no);
    const qw = qawaidDars(t.dars_no);
    return {
      darsNo: t.dars_no,
      judul: meta?.judul ?? "",
      meetingNos: t.meeting_nos ?? [],
      gameId: t.game_id,
      gameName: t.game_name,
      totalQuestions: t.total_questions,
      answeredCount: t.answered_count,
      correctCount: t.correct_count,
      passCorrect: t.pass_correct,
      bacaDone: t.baca_done,
      kosakataDone: t.kosakata_done,
      qawaidDone: t.qawaid_done,
      kosakataStartedAt: t.kosakata_started_at,
      qawaidStartedAt: t.qawaid_started_at,
      gameDone: t.game_done,
      latihanLulus: t.latihan_lulus,
      status: t.status,
      kata: meta?.kata ?? [],
      qawaid: qw ? { judul: qw.judul, isi: qw.isi } : null,
    };
  });

  // Baris status 'selesai' adalah dars yang dihadiri penuh: hanya
  // keterangan kehadiran, bukan tugas. Persen di kepala halaman tetap
  // dihitung dari tugas aktif saja (lulus dibagi total tugas).
  const tasks = allRows.filter((t) => t.status !== "selesai");
  const selesaiRows = allRows.filter((t) => t.status === "selesai");

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "lulus").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-4 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <nav>
          <Link
            href="/student/practice"
            className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
          >
            <span>→</span>
            <span>Kembali ke Latihan Mandiri</span>
          </Link>
        </nav>

        <header className="rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-bold text-white/75">TUGAS SUSULAN</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Tugas Susulan Saya
          </h1>
          <p className="mt-3 text-sm text-white/85">
            Tugas ini muncul karena ada pertemuan yang tidak kamu hadiri.
            Selesaikan langkahnya secara berurutan: baca materi, hafalkan
            kosakata dan pahami qawaid, lalu kerjakan Latihan Mandiri
            sampai lulus. Game solo pada langkah terakhir tidak wajib.
          </p>
          <p className="mt-2 text-xs text-white/70">
            <span className="font-bold">{session.name}</span> · Kelas{" "}
            <span className="font-bold">{session.class_name}</span>
          </p>
          {total > 0 ? (
            <div className="mt-5 rounded-2xl bg-white/15 p-4">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Progres Tugas Susulan: {pct}%</span>
                <span>
                  {done} dari {total} tugas lulus
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-emerald-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : null}
        </header>

        {total === 0 ? (
          <section className="rounded-[2rem] border-2 border-dashed border-emerald-200 bg-white p-12 text-center shadow-lg">
            <div className="text-6xl">✅</div>
            <p className="mt-4 font-bold text-neutral-700">
              Kehadiranmu lengkap.
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Kamu tidak punya tugas susulan. Pertahankan kehadiranmu dan
              terus berlatih lewat Latihan Mandiri.
            </p>
            <div className="mt-6">
              <Link
                href="/student/practice"
                className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-6 py-3 text-sm font-black text-white shadow-md transition hover:bg-teal-700"
              >
                <span>🎯 Buka Latihan Mandiri</span>
              </Link>
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            {tasks.map((task) => (
              <TugasCard key={task.darsNo} task={task} />
            ))}
          </section>
        )}

        {selesaiRows.length > 0 ? (
          <section className="space-y-3">
            <h2 className="px-1 text-sm font-black uppercase tracking-wide text-emerald-700">
              Pertemuan yang sudah kamu hadiri
            </h2>
            {selesaiRows.map((row) => (
              <article
                key={row.darsNo}
                className="flex items-center justify-between gap-4 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xl font-black text-white shadow">
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black text-neutral-900">
                      Dars {row.darsNo}
                      {row.judul ? ` · ${row.judul}` : ""}
                    </p>
                    <p className="text-sm text-neutral-500">
                      Pertemuan {row.meetingNos.join(" dan ")} · kamu hadir
                      penuh
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">
                  Sudah Selesai
                </span>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
