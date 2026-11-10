import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssessmentPlayer } from "./player";

export default async function AttemptPage({
  params,
}: {
  params: { attemptToken: string };
}) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Payload ujian diambil lewat RPC bergerbang attempt_token
  // (assessment_get_payload, migrasi 0091): soal yang sampai ke
  // peramban tidak memuat correct_answer, jawaban tersimpan siswa
  // ikut untuk resume, dan sisa waktu tiap section dihitung server
  // dari started_at + duration_minutes. Dulu halaman ini membaca
  // tabel assessment_* langsung; bentuk props ke player dipertahankan.
  const { data: payload, error } = await db.rpc("assessment_get_payload", {
    p_attempt_token: params.attemptToken,
  });

  if (error || !payload) {
    const message = error?.message ?? "";
    if (message.includes("attempt_completed")) {
      redirect(`/assessment/${params.attemptToken}/result`);
    }
    if (message.includes("token_expired")) {
      redirect("/assessment?error=token_expired");
    }
    notFound();
  }

  if (!payload.assessment) notFound();

  return (
    <AssessmentPlayer
      attempt={payload.attempt}
      assessment={payload.assessment}
      sections={payload.sections ?? []}
      questions={payload.questions ?? []}
      passages={payload.passages ?? []}
      audioGroups={payload.audio_groups ?? []}
      answers={payload.answers ?? []}
      attemptSections={payload.attempt_sections ?? []}
    />
  );
}
