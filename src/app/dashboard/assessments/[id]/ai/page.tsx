import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AIGenerator } from "./ai-generator";

export default async function AIGeneratePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: assessment } = await db
    .from("assessments")
    .select("id, title, assessment_type")
    .eq("id", params.id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!assessment) notFound();

  const { data: questions } = await db
    .from("assessment_questions")
    .select("section_id")
    .eq("assessment_id", assessment.id);

  const { data: sectionRows } = await db
    .from("assessment_sections")
    .select("id, section_type")
    .eq("assessment_id", assessment.id);

  const sectionIdToType = new Map<string, string>();
  for (const s of (sectionRows ?? []) as Array<{
    id: string;
    section_type: string;
  }>) {
    sectionIdToType.set(s.id, s.section_type);
  }

  const counts: Record<string, number> = {
    listening: 0,
    structure: 0,
    reading: 0,
  };
  for (const q of (questions ?? []) as Array<{ section_id: string }>) {
    const t = sectionIdToType.get(q.section_id);
    if (t) counts[t] = (counts[t] ?? 0) + 1;
  }

  const isToafl = assessment.assessment_type === "toafl";
  const targets = isToafl
    ? { listening: 50, structure: 40, reading: 50 }
    : { listening: 50, structure: 40, reading: 50 };

  const sectionCounts = [
    {
      section_type: "listening",
      current_count: counts.listening ?? 0,
      target_count: targets.listening,
    },
    {
      section_type: "structure",
      current_count: counts.structure ?? 0,
      target_count: targets.structure,
    },
    {
      section_type: "reading",
      current_count: counts.reading ?? 0,
      target_count: targets.reading,
    },
  ];

  return (
    <main className="space-y-6">
      <div>
        <Link
          href={`/dashboard/assessments/${assessment.id}`}
          className="text-sm font-bold text-teal-700 underline-offset-4 hover:underline"
        >
          ← Kembali ke Ujian
        </Link>
      </div>

      <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-terracotta-500 to-terracotta-600 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-500/30 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-semibold text-white/80">
            🪄 AI Generator
          </p>
          <h1 className="font-display mt-2 text-2xl font-black sm:text-3xl">
            {assessment.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85">
            Buat soal baru dengan AI, atau paste draft soal yang sudah Anda
            punya untuk dirapikan otomatis.
          </p>
        </div>
      </header>

      <AIGenerator
        assessmentId={assessment.id}
        assessmentType={assessment.assessment_type}
        sectionCounts={sectionCounts}
      />
    </main>
  );
}