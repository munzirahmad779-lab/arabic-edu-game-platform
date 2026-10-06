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

  const { data: attempt } = await db
    .from("assessment_attempts")
    .select(
      "id, attempt_token, assessment_id, student_name, status, started_at, current_section_order, current_question_number",
    )
    .eq("attempt_token", params.attemptToken)
    .maybeSingle();

  if (!attempt) notFound();

  if (attempt.status === "completed") {
    redirect(`/assessment/${params.attemptToken}/result`);
  }

  const { data: assessment } = await db
    .from("assessments")
    .select("id, title, description")
    .eq("id", attempt.assessment_id)
    .maybeSingle();

  if (!assessment) notFound();

  const { data: sections } = await db
    .from("assessment_sections")
    .select(
      "id, section_order, section_type, title, instructions, duration_minutes, audio_play_once, allow_review",
    )
    .eq("assessment_id", attempt.assessment_id)
    .order("section_order");

  const { data: questions } = await db
    .from("assessment_questions")
    .select(
      "id, section_id, question_number, question_text, option_a, option_b, option_c, option_d, passage_id, audio_group_id",
    )
    .eq("assessment_id", attempt.assessment_id)
    .order("question_number");

  const { data: passages } = await db
    .from("assessment_passages")
    .select("id, section_id, passage_order, title, content")
    .eq("assessment_id", attempt.assessment_id);

  const { data: audioGroups } = await db
    .from("assessment_audio_groups")
    .select("id, section_id, group_order, title, audio_url, storage_path")
    .eq("assessment_id", attempt.assessment_id);

  const { data: answers } = await db
    .from("assessment_answers")
    .select("question_id, selected_answer")
    .eq("attempt_id", attempt.id);

  const { data: attemptSections } = await db
    .from("assessment_attempt_sections")
    .select("section_id, status, started_at, finished_at, time_spent_seconds")
    .eq("attempt_id", attempt.id);

  return (
    <AssessmentPlayer
      attempt={attempt}
      assessment={assessment}
      sections={sections ?? []}
      questions={questions ?? []}
      passages={passages ?? []}
      audioGroups={audioGroups ?? []}
      answers={answers ?? []}
      attemptSections={attemptSections ?? []}
    />
  );
}