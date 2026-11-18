import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostTesToggle } from "./post-tes-toggle";

type SearchParams = { class?: string };

type OverviewRow = {
  student_id: string;
  student_name: string;
  sent_count: number;
  graded_count: number;
  total_questions: number;
};

export default async function TeacherPostTesPage({
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

  const { data: statusData, error: statusError } = await supabase.rpc(
    "teacher_post_test_status",
  );
  const statusRow = (statusData ?? [])[0] as
    | { is_open: boolean; total_questions: number }
    | undefined;
  const loadError = Boolean(statusError);
  if (statusError) {
    console.error("[post-tes] status rpc error:", statusError);
  }
  const isOpen = statusRow?.is_open === true;
  const totalQuestions = statusRow?.total_questions ?? 0;

  let rows: OverviewRow[] = [];
  if (selected && !loadError) {
    const { data, error } = await supabase.rpc("teacher_post_test_overview", {
      p_class_id: selected.id,
    });
    if (error) {
      console.error("[post-tes] overview rpc error:", error);
    }
    rows = (data ?? []) as OverviewRow[];
  }

  const totalSent = rows.reduce((acc, r) => acc + r.sent_count, 0);
  const totalGraded = rows.reduce((acc, r) => acc + r.graded_count, 0);
  const finishedStudents = rows.filter(
    (r) => r.total_questions > 0 && r.sent_count >= r.total_questions,
  ).length;

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

      <header className="rounded-[2rem] bg-gradient-to-l from-rose-700 via-red-600 to-orange-500 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-white/75">POST TES VN</p>
        <h1 className="mt-1 text-3xl font-black">Post Tes: Ujian Akhir</h1>
        <p className="mt-2 text-sm text-white/85">
          Siswa menjawab soal post tes dengan merekam suaranya. Rekaman
          tersimpan di Google Drive; halaman ini memantau siapa yang
          sudah mengirim dan membuka rincian jawaban tiap siswa untuk
          didengarkan dan dinilai. Post tes hanya bisa dikerjakan siswa
          selama keadaan di bawah ini DIBUKA.
        </p>
        {selected ? (
          <p className="mt-2 text-xs text-white/70">
            Kelas <span className="font-bold">{selected.name}</span> ·{" "}
            {totalQuestions} soal · {finishedStudents} siswa sudah
            mengirim semua jawaban
          </p>
        ) : null}
      </header>

      {loadError ? (
        <section className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Data post tes belum bisa dimuat. Bila migrasi 0126 belum
          dijalankan, jalankan dulu berkas
          supabase/migrations/0126_post_tes_vn.sql di SQL Editor Supabase
          proyek Magguru.
        </section>
      ) : (
        <>
          <section className="rounded-[2rem] border border-rose-100 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-black text-neutral-900">
              Keadaan Post Tes
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Buka post tes hanya sesudah pembelajaran dinyatakan usai.
              Selama tertutup, siswa melihat pemberitahuan bahwa post tes
              belum dibuka dan tidak bisa mengirim jawaban.
            </p>
            <div className="mt-4">
              <PostTesToggle isOpen={isOpen} />
            </div>
            <p className="mt-4 text-sm text-neutral-600">
              Total jawaban terkirim:{" "}
              <span className="font-bold">{totalSent}</span> · sudah
              dinilai: <span className="font-bold">{totalGraded}</span>
            </p>
          </section>

          {classList.length > 1 ? (
            <nav className="flex flex-wrap gap-2">
              {classList.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/post-tes?class=${c.id}`}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    selected?.id === c.id
                      ? "bg-rose-600 text-white shadow"
                      : "border border-neutral-200 bg-white text-neutral-700 hover:border-rose-300 hover:text-rose-700"
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
                Buat kelas terlebih dahulu untuk melihat progres post tes.
              </p>
            </section>
          ) : (
            <section className="rounded-[2rem] border border-rose-100 bg-white p-6 shadow-lg">
              <ul className="divide-y divide-neutral-100">
                {rows.map((r) => {
                  const pct =
                    r.total_questions > 0
                      ? Math.round((r.sent_count / r.total_questions) * 100)
                      : 0;
                  return (
                    <li key={r.student_id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-neutral-900">
                          {r.student_name}
                        </p>
                        <span className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                          <span>
                            {r.sent_count} dari {r.total_questions} terkirim
                            · {pct}% · {r.graded_count} sudah dinilai
                          </span>
                          <Link
                            href={`/dashboard/post-tes/${r.student_id}?class=${selected.id}`}
                            className="rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white transition hover:bg-rose-700"
                          >
                            Lihat Jawaban
                          </Link>
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 100 ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
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
        </>
      )}
    </main>
  );
}
