import { notFound, redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PracticePlayer } from "./practice-player";

type MediaItem = {
  id: string;
  media_type: "image" | "audio" | "video" | string;
  storage_path: string | null;
  mime_type: string | null;
  max_play_count: number | null;
};

type Option = {
  id: string;
  option_key: string;
  option_text: string;
};

type Question = {
  id: string;
  question_text: string;
  difficulty: string;
  options: Option[];
  media: MediaItem[];
};

type GameData = {
  game_id: string;
  game_name: string;
  game_mode: string;
  questions: Question[];
};

type ProgressRow = {
  question_id: string;
  selected_option_key: string;
  is_correct: boolean;
  answered_at: string;
  correct_option_key: string;
  explanation: string | null;
};

export default async function PracticeGamePage({
  params,
}: {
  params: { gameId: string };
}) {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("student_get_practice_game", {
    p_token: token,
    p_game_id: params.gameId,
  });

  if (error || !data || !data[0]) {
    notFound();
  }

  const game = data[0] as GameData;

  const { data: progressData } = await supabase.rpc(
    "student_get_practice_progress",
    {
      p_token: token,
      p_game_id: params.gameId,
    },
  );

  const progress = (progressData ?? []) as ProgressRow[];

  return (
    <PracticePlayer
      token={token}
      game={game}
      initialProgress={progress}
      studentName={session.name}
      className={session.class_name}
      dict={dict}
      locale={locale}
    />
  );
}