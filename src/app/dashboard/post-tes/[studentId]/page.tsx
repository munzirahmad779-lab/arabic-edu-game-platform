import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = { class?: string };

type DetailRow = {
  student_name: string;
  question_id: string;
  urutan: number;
  dars: number;
  pertanyaan: string;
  jawaban_model: string | null;
  answer_id: string | null;
  drive_file_id: string | null;
  drive_link: string | null;
  durasi_detik: number | null;
  skor: number | null;
  transkrip: string | null;
  catatan: string | null;
  graded_at: string | null;
  answered_at: string | null;
};

function fmtDurasi(totalDetik: number | null): string {
  if (totalDetik === null) return "";
  const m = Math.floor(totalDetik / 60);
  const s = totalDetik % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtWaktu(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TeacherPostTesStudentPage({
  params,
  searchParams,
}: {
  params: { studentId: string };
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("teacher_post_test_student", {
    p_student_id: params.studentId,
  });
  if (error) {
    console.error("[post-tes/student] rpc error:", error);
  }
  const rows = (data ?? []) as DetailRow[];

  let studentName = rows[0]?.student_name ?? "";
  if (!studentName) {
    const { data: studentRow } = await supabase
      .from("students")
      .select("name")
      .eq("id", params.studentId)
      .maybeSingle();
    studentName = studentRow?.name ?? "Siswa";
  }

  const total = rows.length;
  const sent = rows.filter((r) => r.answer_id !== null).length;
  const gradedRows = rows.filter((r) => r.skor !== null);
  const avgScore =
    gradedRows.length > 0
      ? Math.round(
          (gradedRows.reduce((acc, r) => acc + (r.skor ?? 0), 0) /
            gradedRows.length) *
            10,
        ) / 10
      : null;

  const backHref = searchParams.class
    ? `/dashboard/post-tes?class=${searchParams.class}`
    : "/dashboard/post-tes";

  return (
    <main className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
        >
          ← Kembali ke Post Tes
        </Link>
      </div>

      <header className="rounded-[2rem] bg-gradient-to-l from-rose-700 via-red-600 to-orange-500 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-white/75">
          RINCIAN JAWABAN POST TES
        </p>
        <h1 className="mt-1 text-3xl font-black">{studentName}</h1>
        <p className="mt-2 text-sm text-white/85">
          {sent} dari {total} soal terkirim
          {avgScore !== null
            ? ` · rata-rata skor sementara ${avgScore} dari ${gradedRows.length} jawaban yang dinilai`
            : " · belum ada jawaban yang dinilai"}
        </p>
      </header>

      {error ? (
        <section className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Rincian jawaban belum bisa dimuat. Bila migrasi 0126 belum
          dijalankan, jalankan dulu berkas
          supabase/migrations/0126_post_tes_vn.sql di SQL Editor Supabase
          proyek Magguru.
        </section>
      ) : total === 0 ? (
        <section className="rounded-[2rem] border-2 border-dashed border-neutral-200 bg-white p-12 text-center shadow-lg">
          <p className="font-bold text-neutral-700">
            Soal post tes belum dimasukkan.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Daftar soal masih kosong, jadi belum ada rincian yang bisa
            ditampilkan untuk siswa ini.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {rows.map((r) => (
            <article
              key={r.question_id}
              className="rounded-[2rem] border border-rose-100 bg-white p-5 shadow-lg"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-rose-600">
                  Soal {r.urutan} · Dars {r.dars}
                </p>
                {r.answer_id ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    ✓ Terkirim {fmtWaktu(r.answered_at)}
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-500">
                    Belum dijawab
                  </span>
                )}
              </div>

              <p
                dir="auto"
                className="mt-2 whitespace-pre-wrap text-base font-bold leading-relaxed text-neutral-900"
              >
                {r.pertanyaan}
              </p>

              {r.jawaban_model ? (
                <div className="mt-3 rounded-2xl bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide text-neutral-500">
                    Jawaban model
                  </p>
                  <p
                    dir="auto"
                    className="mt-1 whitespace-pre-wrap text-sm text-neutral-700"
                  >
                    {r.jawaban_model}
                  </p>
                </div>
              ) : null}

              {r.answer_id ? (
                <div className="mt-4 space-y-3">
                  {r.drive_file_id ? (
                    <audio
                      controls
                      preload="none"
                      src={`https://drive.google.com/uc?export=download&id=${r.drive_file_id}`}
                      className="w-full"
                    />
                  ) : null}
                  <p className="text-sm text-neutral-500">
                    {r.durasi_detik !== null
                      ? `Durasi rekaman ${fmtDurasi(r.durasi_detik)} · `
                      : ""}
                    <a
                      href={r.drive_link ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-rose-700 underline"
                    >
                      Buka rekaman di Google Drive
                    </a>
                  </p>

                  {r.graded_at ? (
                    <div className="rounded-2xl bg-teal-50 px-4 py-3">
                      <p className="text-sm font-black text-teal-900">
                        Skor: {r.skor ?? "-"} / 100
                      </p>
                      {r.transkrip ? (
                        <p
                          dir="auto"
                          className="mt-2 whitespace-pre-wrap text-sm text-teal-900"
                        >
                          <span className="font-bold">Transkrip: </span>
                          {r.transkrip}
                        </p>
                      ) : null}
                      {r.catatan ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-teal-900">
                          <span className="font-bold">Catatan: </span>
                          {r.catatan}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                      Belum dinilai
                    </p>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
