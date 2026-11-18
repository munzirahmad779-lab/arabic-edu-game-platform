import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { PostTesClient, type PostTestQuestion } from "./post-tes-client";

type PostTestPayload = {
  is_open: boolean;
  total_questions: number;
  answered_count: number;
  questions: PostTestQuestion[];
};

export default async function StudentPostTesPage() {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const locale = await getLocale();
  const isRtl = locale === "ar";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_get_post_test", {
    p_token: token,
  });

  if (error) {
    console.error("[StudentPostTesPage]", error);
  }

  const payload = (data ?? null) as PostTestPayload | null;
  const isOpen = payload?.is_open === true;
  const questions = payload?.questions ?? [];
  const totalQuestions = payload?.total_questions ?? questions.length;
  const answeredCount = payload?.answered_count ?? 0;

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
          <p className="text-xs font-bold text-white/75">POST TES</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Post Tes: Ujian Akhir
          </h1>
          <p className="mt-3 text-sm text-white/85">
            Pada ujian akhir ini kamu menjawab soal dengan merekam
            suaramu, seperti mengirim pesan suara. Dengarkan baik-baik
            soalnya, rekam jawabanmu dengan jelas, lalu kirim. Gurumu
            akan mendengarkan dan menilai setiap rekamanmu.
          </p>
          <p className="mt-2 text-xs text-white/70">
            <span className="font-bold">{session.name}</span> · Kelas{" "}
            <span className="font-bold">{session.class_name}</span>
          </p>
        </header>

        {!payload ? (
          <section className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            Halaman post tes belum bisa dimuat. Bila migrasi 0126 belum
            dijalankan, guru perlu menjalankan berkas
            supabase/migrations/0126_post_tes_vn.sql di SQL Editor
            Supabase proyek Magguru terlebih dahulu.
          </section>
        ) : !isOpen ? (
          <section className="rounded-[2rem] border-2 border-dashed border-amber-200 bg-white p-12 text-center shadow-lg">
            <div className="text-6xl">🔒</div>
            <p className="mt-4 font-black text-neutral-800">
              Post tes belum dibuka. Tunggu pengumuman guru.
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Ujian akhir ini baru bisa dikerjakan sesudah gurumu
              menyatakan pembelajaran telah usai dan membuka post tes
              dari halaman gurunya. Sambil menunggu, lanjutkan latihanmu
              lewat Latihan Mandiri dan selesaikan Tugas Susulanmu.
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
        ) : totalQuestions === 0 ? (
          <section className="rounded-[2rem] border-2 border-dashed border-neutral-200 bg-white p-12 text-center shadow-lg">
            <div className="text-6xl">📝</div>
            <p className="mt-4 font-bold text-neutral-700">
              Soal post tes belum dimasukkan.
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Gurumu sudah membuka post tes, tetapi daftar soalnya belum
              tersedia. Tunggu sebentar lalu muat ulang halaman ini.
            </p>
          </section>
        ) : (
          <PostTesClient
            questions={questions}
            totalQuestions={totalQuestions}
            initialAnswered={answeredCount}
          />
        )}
      </div>
    </main>
  );
}
