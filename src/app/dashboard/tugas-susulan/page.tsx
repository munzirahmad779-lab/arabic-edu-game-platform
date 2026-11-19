import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { studentGameName } from "@/modules/game-results/student-games";

type SearchParams = { class?: string };

type OverviewRow = {
  student_id: string;
  student_name: string;
  total_tasks: number;
  done_tasks: number;
};

type GameResultRow = {
  student_id: string;
  student_name: string;
  game_slug: string;
  score: number;
  correct_count: number;
  total_questions: number;
  finished_at: string;
};

type ProgressDetailRow = {
  student_id: string;
  student_name: string;
  dars_no: number;
  baca_done: boolean;
  answered_count: number;
  correct_count: number;
  total_questions: number;
};

// Satu segmen rincian proses per dars, contoh: "Dars 3 (Baca
// selesai)" atau "Dars 1 (Baca selesai; Latihan 10 dari
// 30 terjawab)".
function segmenProses(d: ProgressDetailRow): string {
  const selesai: string[] = [];
  if (d.baca_done) selesai.push("Baca");
  const parts: string[] = [];
  if (selesai.length > 0) parts.push(`${selesai.join(", ")} selesai`);
  if (d.total_questions > 0) {
    parts.push(
      `Latihan ${d.answered_count} dari ${d.total_questions} terjawab`,
    );
  } else if (d.answered_count > 0) {
    parts.push(`Latihan ${d.answered_count} terjawab`);
  }
  if (parts.length === 0) parts.push("baru dimulai");
  return `Dars ${d.dars_no} (${parts.join("; ")})`;
}

function fmtWaktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TeacherTugasSusulanPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Kelas diambil dari data kelas milik guru yang masuk (RLS membatasi
  // ke kelas sendiri); tidak ada ID kelas yang ditanam di kode.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .order("created_at", { ascending: true });

  const classList = classes ?? [];
  const requested = searchParams.class;
  const selected =
    classList.find((c) => c.id === requested) ??
    classList.find((c) => c.name.toLowerCase().includes("mangkoso")) ??
    classList[0];

  let rows: OverviewRow[] = [];
  let loadError = false;
  const gameResultsByStudent = new Map<string, GameResultRow[]>();
  const progressDetailByStudent = new Map<string, ProgressDetailRow[]>();
  if (selected) {
    const { data, error } = await supabase.rpc("teacher_catchup_overview", {
      p_class_id: selected.id,
    });
    if (error) {
      console.error("[tugas-susulan] rpc error:", error);
      loadError = true;
    }
    rows = (data ?? []) as OverviewRow[];

    // Hasil permainan mandiri terbaru per siswa per game (migrasi
    // 0116). Bila RPC belum ada (migrasi belum dijalankan), bagian ini
    // cukup kosong tanpa menggagalkan halaman.
    const { data: gameData, error: gameError } = await supabase.rpc(
      "teacher_student_game_results",
      { p_class_id: selected.id },
    );
    if (gameError) {
      console.error("[tugas-susulan] game results rpc error:", gameError);
    }
    for (const gr of (gameData ?? []) as GameResultRow[]) {
      const list = gameResultsByStudent.get(gr.student_id) ?? [];
      list.push(gr);
      gameResultsByStudent.set(gr.student_id, list);
    }

    // Rincian dars yang sedang berproses per siswa (migrasi 0132,
    // perintah pemilik 18 Nov 2026: munculkan siswa yang sudah
    // mengerjakan tetapi belum lulus, yang selama ini tidak
    // terlihat dari hitungan ringkasan). Bila RPC belum ada
    // (migrasi belum dijalankan), bagian ini cukup kosong tanpa
    // menggagalkan halaman, sama seperti hasil game di atas.
    const { data: detailData, error: detailError } = await supabase.rpc(
      "teacher_catchup_progress_detail",
      { p_class_id: selected.id },
    );
    if (detailError) {
      console.error("[tugas-susulan] progress detail rpc error:", detailError);
    }
    for (const d of (detailData ?? []) as ProgressDetailRow[]) {
      const list = progressDetailByStudent.get(d.student_id) ?? [];
      list.push(d);
      progressDetailByStudent.set(d.student_id, list);
    }
  }

  const withTasks = rows.filter((r) => r.total_tasks > 0);

  return (
    <main className="space-y-6">
      <div>
        <Link
          href="/dashboard/reports"
          className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
        >
          ← Kembali ke Laporan Harian
        </Link>
      </div>

      <header className="rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-white/75">TUGAS SUSULAN</p>
        <h1 className="mt-1 text-3xl font-black">Progres Tugas Susulan</h1>
        <p className="mt-2 text-sm text-white/85">
          Siswa yang bolong pada pertemuan 1 s.d. 30 mendapat satu tugas per
          dars yang terlewat. Satu tugas terhitung lulus bila siswa tuntas
          membaca materi dan lulus Latihan Mandiri dars itu (salah maksimal
          5 pada permainan minimal 25 soal). Di bawah tiap nama juga tampil hasil
          permainan mandiri terbarunya dari semua game solo siswa.
        </p>
        {selected ? (
          <p className="mt-2 text-xs text-white/70">
            Kelas <span className="font-bold">{selected.name}</span> ·{" "}
            {withTasks.length} siswa punya tugas
          </p>
        ) : null}
      </header>

      {classList.length > 1 ? (
        <nav className="flex flex-wrap gap-2">
          {classList.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/tugas-susulan?class=${c.id}`}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                selected?.id === c.id
                  ? "bg-violet-600 text-white shadow"
                  : "border border-neutral-200 bg-white text-neutral-700 hover:border-violet-300 hover:text-violet-700"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {!selected ? (
        <section className="rounded-[2rem] border-2 border-dashed border-neutral-200 bg-white p-12 text-center shadow-lg">
          <p className="font-bold text-neutral-700">Belum ada kelas.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Buat kelas terlebih dahulu untuk melihat progres tugas susulan.
          </p>
        </section>
      ) : loadError ? (
        <section className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Data progres belum bisa dimuat. Bila migrasi 0115 dan 0116 belum
          dijalankan, jalankan dulu berkas
          supabase/migrations/0115_tugas_susulan.sql dan
          supabase/migrations/0116_game_solo_siswa.sql di SQL Editor
          Supabase proyek Magguru.
        </section>
      ) : (
        <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
          <ul className="divide-y divide-neutral-100">
            {rows.map((r) => {
              const pct =
                r.total_tasks > 0
                  ? Math.round((r.done_tasks / r.total_tasks) * 100)
                  : 100;
              return (
                <li key={r.student_id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-neutral-900">
                      {r.student_name}
                    </p>
                    {r.total_tasks > 0 ? (
                      <span className="text-sm text-neutral-600">
                        {r.done_tasks} dari {r.total_tasks} tugas lulus ·{" "}
                        {pct}%
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                        Kehadiran lengkap, tanpa tugas
                      </span>
                    )}
                  </div>
                  {r.total_tasks > 0 ? (
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 100 ? "bg-emerald-500" : "bg-violet-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : null}
                  {(progressDetailByStudent.get(r.student_id) ?? []).length >
                  0 ? (
                    <p className="mt-2 text-sm text-violet-800">
                      Sedang proses:{" "}
                      {(
                        progressDetailByStudent.get(r.student_id) ?? []
                      )
                        .map(segmenProses)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {(gameResultsByStudent.get(r.student_id) ?? []).length >
                  0 ? (
                    <div className="mt-3 rounded-2xl bg-teal-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wide text-teal-800">
                        Hasil game mandiri terbaru
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {(gameResultsByStudent.get(r.student_id) ?? []).map(
                          (gr) => (
                            <li
                              key={gr.game_slug}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <span className="font-bold text-neutral-800">
                                🎮 {studentGameName(gr.game_slug)}
                              </span>
                              <span className="text-neutral-600">
                                Skor {gr.score} · Benar {gr.correct_count}{" "}
                                dari {gr.total_questions} soal ·{" "}
                                {fmtWaktu(gr.finished_at)}
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              Belum ada siswa di kelas ini.
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
}
