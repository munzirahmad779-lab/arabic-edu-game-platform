import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameRegistry } from "@/lib/game-engine/registry";
import { ProjectorScreen } from "./projector-screen";
import type { RawOption, RawQuestion } from "@/lib/game-engine/types";

export const metadata = {
  title: "Mode Proyektor (Hot Seat) - Magguru",
};

export default async function ProjectorPage({
  params,
}: {
  params: { gameId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/dashboard/games/${params.gameId}/projector`);
  }

  // 1. Fetch game details
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, name, mode, game_type, class_id")
    .eq("id", params.gameId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (gameError || !game) {
    redirect("/dashboard/games");
  }

  // 2. Fetch class students if class_id is linked
  let classStudents: Array<{ id: string; name: string }> = [];
  if (game.class_id) {
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, name")
      .eq("class_id", game.class_id)
      .order("name", { ascending: true });

    if (studentsData) {
      classStudents = studentsData;
    }
  }

  // 3. Fetch questions linked to game
  const { data: gqData } = await supabase
    .from("game_questions")
    .select("question_id, position")
    .eq("game_id", game.id)
    .order("position", { ascending: true });

  const qIds = (gqData ?? []).map((g) => g.question_id);

  let rawQuestions: RawQuestion[] = [];
  if (qIds.length > 0) {
    const { data: qData } = await supabase
      .from("questions")
      .select("id, question_text, difficulty, correct_option_key, explanation")
      .in("id", qIds);

    const { data: optData } = await supabase
      .from("question_options")
      .select("id, question_id, option_key, option_text")
      .in("question_id", qIds)
      .order("option_key", { ascending: true });

    const qMap = new Map((qData ?? []).map((q) => [q.id, q]));
    const optMap = new Map<string, RawOption[]>();

    for (const opt of optData ?? []) {
      const list = optMap.get(opt.question_id) ?? [];
      list.push({
        id: opt.id,
        option_key: opt.option_key,
        option_text: opt.option_text,
      });
      optMap.set(opt.question_id, list);
    }

    const rawQuestionsList: RawQuestion[] = [];
    let idx = 0;
    for (const gq of gqData ?? []) {
      const q = qMap.get(gq.question_id);
      if (q) {
        rawQuestionsList.push({
          id: q.id,
          position: idx++,
          question_text: q.question_text ?? "",
          difficulty: q.difficulty ?? "easy",
          correct_option_key: q.correct_option_key ?? "A",
          explanation: q.explanation ?? "",
          options: optMap.get(q.id) ?? [],
        });
      }
    }
    rawQuestions = rawQuestionsList;
  }

  const initialGameType = GameRegistry.resolve(game.game_type, game.mode);

  return (
    <ProjectorScreen
      gameId={game.id}
      gameName={game.name}
      initialGameType={initialGameType}
      questions={rawQuestions}
      classStudents={classStudents}
    />
  );
}
