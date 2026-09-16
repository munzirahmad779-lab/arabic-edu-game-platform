import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewList } from "./review-list";

type Submission = {
  submission_id: string;
  student_id: string;
  student_name: string;
  answer_text: string;
  duration_seconds: number | null;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_scores_json: {
    content: number;
    grammar: number;
    vocabulary: number;
  } | null;
  teacher_override_score: number | null;
  teacher_override_feedback: string | null;
  submitted_at: string;
};

export default async function EssayReviewPage({
  params,
}: {
  params: { classId: string; essayId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cek essay milik guru
  const { data: essay } = await supabase
    .from("essay_assignments")
    .select("id, title, question_text, duration_minutes, is_published")
    .eq("id", params.essayId)
    .eq("class_id", params.classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!essay) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subsData } = await (supabase as any).rpc(
    "teacher_essay_submissions",
    { p_essay_id: params.essayId },
  );

  const submissions = (subsData ?? []) as Submission[];

  return (
    <main className="space-y-6" dir="rtl">
      <div>
        <Link
          href={`/dashboard/classes/${params.classId}`}
          className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
        >
          ← العودة إلى الفصل
        </Link>
      </div>

      <header className="rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-white/75">
          مراجعة مهمة الكتابة
        </p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">
          ✍️ {essay.title}
        </h1>
        <p className="mt-2 text-sm text-white/85">
          ⏱ {essay.duration_minutes} دقيقة · 📥 {submissions.length} إجابة
        </p>
      </header>

      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-black text-violet-700">السؤال</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-800">
          {essay.question_text}
        </p>
      </section>

      <ReviewList submissions={submissions} />
    </main>
  );
}