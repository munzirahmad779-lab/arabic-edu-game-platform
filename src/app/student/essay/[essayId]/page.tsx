import { notFound, redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { EssayPlayer } from "./essay-player";

type EssayData = {
  id: string;
  title: string;
  theme: string | null;
  question_text: string;
  duration_minutes: number;
  my_answer: string | null;
  my_score: number | null;
  my_feedback: string | null;
  my_scores_json: {
    content: number;
    grammar: number;
    vocabulary: number;
  } | null;
  submitted_at: string | null;
};

export default async function EssayPlayPage({
  params,
}: {
  params: { essayId: string };
}) {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_get_essay", {
    p_token: token,
    p_essay_id: params.essayId,
  });

  if (error || !data || !data[0]) {
    notFound();
  }

  const essay = data[0] as EssayData;

  return (
    <EssayPlayer
      token={token}
      essay={essay}
      studentName={session.name}
      className={session.class_name}
      dict={dict}
      locale={locale}
    />
  );
}