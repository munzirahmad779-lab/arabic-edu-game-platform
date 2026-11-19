import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { judulDars } from "@/modules/tugas-susulan/judul";
import { STUDENT_GAMES } from "@/modules/game-results/student-games";
import { SYARAT_JUMLAH_DARS_TUNTAS } from "@/modules/game-results/solo-lock";
import { statusKunciGameSolo } from "@/modules/game-results/solo-lock-server";
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
    return {
      darsNo: t.dars_no,
      judul: judulDars(t.dars_no) ?? "",
      meetingNos: t.meeting_nos ?? [],
      gameId: t.game_id,
      gameName: t.game_name,
      totalQuestions: t.total_questions,
      answeredCount: t.answered_count,
      correctCount: t.correct_count,
      passCorrect: t.pass_correct,
      bacaDone: t.baca_done,
      latihanLulus: t.latihan_lulus,
      status: t.status,
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

  // Bagian Game Solo di paling depan halaman (perintah pemilik,
  // 18 Nov 2026): permainan dipindah keluar dari kartu tugas menjadi
  // jalan masuk bermain tersendiri, dengan kunci yang sama seperti
  // di halaman Latihan Mandiri (latihan tuntas untuk 7 dars yang
  // berbeda). Bagian ini tidak terhubung ke status tugas apa pun.
  const soloStatus = await statusKunciGameSolo();
  const soloTerbuka = soloStatus.terbuka;
  const jumlahDarsTuntas = soloStatus.jumlahDarsTuntas;

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
            Dua langkah WAJIB dan harus dikerjakan segera: baca materi
            sampai selesai (Langkah 1), lalu kerjakan Latihan Mandiri
            dars itu sampai lulus (Langkah 2). Tugasmu lulus bila kedua
            langkah wajib itu selesai.
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

        <section className="rounded-[2rem] border border-teal-100 bg-white p-6 shadow-lg">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-black text-neutral-900">
              Game Solo
            </h2>
            {soloTerbuka ? (
              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700">
                {STUDENT_GAMES.length} permainan
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                🔒 Terkunci
              </span>
            )}
          </div>
          {soloTerbuka ? (
            <p className="mb-4 text-sm text-neutral-500">
              Permainan utama Magguru yang bisa kamu mainkan sendirian
              dari akunmu. Selesaikan satu ronde penuh, hasilmu tercatat
              dan terlihat oleh gurumu.
            </p>
          ) : (
            <p className="mb-4 text-sm text-neutral-500">
              Game Solo terbuka sesudah kamu menyelesaikan Latihan Siswa
              untuk {SYARAT_JUMLAH_DARS_TUNTAS} dars yang berbeda sampai
              tuntas. Kemajuanmu sekarang: {jumlahDarsTuntas} dari{" "}
              {SYARAT_JUMLAH_DARS_TUNTAS} dars. Selesaikan dulu latihan
              pada kartu tugasmu di bawah ini.
            </p>
          )}
          <ul className="space-y-3">
            {STUDENT_GAMES.map((g) => (
              <li key={g.slug}>
                {soloTerbuka ? (
                  <Link
                    href={`/student/play/${g.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50 hover:shadow-md"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-2xl text-white shadow-md transition group-hover:scale-110">
                        {g.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-neutral-900 group-hover:text-teal-700">
                          {g.name}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                          {g.desc}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {g.bankNote}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-2xl text-neutral-400 transition group-hover:text-teal-600">
                      ←
                    </span>
                  </Link>
                ) : (
                  <div
                    aria-disabled="true"
                    className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-300 text-2xl text-white shadow-md grayscale">
                        {g.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-neutral-700">
                          {g.name}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                          {g.desc}
                        </p>
                        <p className="mt-1">
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                            Terkunci, selesaikan latihan untuk{" "}
                            {SYARAT_JUMLAH_DARS_TUNTAS} dars dulu
                          </span>
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-2xl">🔒</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

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
