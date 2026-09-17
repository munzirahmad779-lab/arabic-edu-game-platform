import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function startAttempt(fd: FormData) {
  "use server";
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const token = String(fd.get("token") ?? "").trim().toUpperCase();
  const name = String(fd.get("name") ?? "").trim();

  if (!token || !name) {
    redirect("/assessment?error=" + encodeURIComponent("Token & nama wajib diisi."));
  }

  const { data: tokenRow } = await db
    .from("assessment_tokens")
    .select("id, assessment_id, expires_at, is_active, max_uses, used_count")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!tokenRow) {
    redirect("/assessment?error=" + encodeURIComponent("Token tidak valid."));
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    redirect("/assessment?error=" + encodeURIComponent("Token sudah kedaluwarsa."));
  }

  if (tokenRow.used_count >= tokenRow.max_uses) {
    redirect("/assessment?error=" + encodeURIComponent("Token sudah mencapai batas pemakaian."));
  }

  const { data: assessmentRow } = await db
    .from("assessments")
    .select("id, is_published")
    .eq("id", tokenRow.assessment_id)
    .maybeSingle();

  if (!assessmentRow || !assessmentRow.is_published) {
    redirect("/assessment?error=" + encodeURIComponent("Ujian belum dipublikasikan."));
  }

  const attemptToken = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");

  const { data: attemptRow, error: attemptErr } = await db
    .from("assessment_attempts")
    .insert({
      attempt_token: attemptToken,
      assessment_id: tokenRow.assessment_id,
      token_id: tokenRow.id,
      student_name: name,
      status: "in_progress",
      current_section_order: 1,
      current_question_number: 1,
    })
    .select("id")
    .single();

  if (attemptErr || !attemptRow) {
    redirect(
      "/assessment?error=" +
        encodeURIComponent("Gagal memulai ujian. Coba lagi."),
    );
  }

  await db
    .from("assessment_tokens")
    .update({ used_count: tokenRow.used_count + 1 })
    .eq("id", tokenRow.id);

  // Buat attempt_sections untuk semua section
  const { data: sections } = await db
    .from("assessment_sections")
    .select("id, section_order")
    .eq("assessment_id", tokenRow.assessment_id)
    .order("section_order");

  if (sections && sections.length > 0) {
    const rows = sections.map((s: { id: string }, idx: number) => ({
      attempt_id: attemptRow.id,
      section_id: s.id,
      status: idx === 0 ? "in_progress" : "pending",
      started_at: idx === 0 ? new Date().toISOString() : null,
    }));
    await db.from("assessment_attempt_sections").insert(rows);
  }

  redirect(`/assessment/${attemptToken}`);
}

export default async function AssessmentEntryPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="min-h-screen bg-warmwhite p-4 sm:p-6">
      <div className="mx-auto max-w-md space-y-6 py-12">
        <div className="flex justify-center">
          <Image
            src="/logo-horizontal.png"
            alt="Magguru"
            width={400}
            height={175}
            className="h-16 w-auto sm:h-20"
            priority
          />
        </div>

        <div className="text-center">
          <h1 className="font-display text-3xl font-black text-teal-700">
            Masuk Ujian
          </h1>
          <p className="mt-2 text-sm text-softslate/70">
            Masukkan token yang diberikan guru Anda.
          </p>
        </div>

        {searchParams.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {searchParams.error}
          </div>
        ) : null}

        <form action={startAttempt} className="aesthetic-card space-y-4">
          <div>
            <label
              htmlFor="token"
              className="block text-sm font-bold text-teal-700"
            >
              Token
            </label>
            <input
              id="token"
              name="token"
              type="text"
              required
              maxLength={8}
              minLength={8}
              autoComplete="off"
              placeholder="ABCD1234"
              autoFocus
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-center text-lg font-mono font-black tracking-[0.3em] uppercase outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
              dir="ltr"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-bold text-teal-700"
            >
              Nama Lengkap
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-4 py-3 outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            Mulai Ujian →
          </button>

          <p className="text-center text-xs text-softslate/60">
            Pastikan koneksi internet stabil. Timer akan mulai berjalan.
          </p>
        </form>

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