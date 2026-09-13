"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MAX_GAME_NAME_LENGTH = 120;

type GameMode = "competitive" | "learning";
type RankingVisibility = "full" | "hidden" | "self_only";
type ExplanationTiming =
  | "after_each_question"
  | "after_game_only"
  | "never";

function normalizeName(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseGameMode(value: FormDataEntryValue | null): GameMode | null {
  return value === "competitive" || value === "learning" ? value : null;
}

function parseRankingVisibility(
  value: FormDataEntryValue | null,
): RankingVisibility | null {
  return value === "full" ||
    value === "hidden" ||
    value === "self_only"
    ? value
    : null;
}

export async function createGame(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = normalizeName(formData.get("name"));

  const classId = normalizeName(formData.get("class_id"));

  const mode = parseGameMode(formData.get("mode"));

  const durationSeconds = Number(formData.get("duration_seconds"));

  const rankingVisibility = parseRankingVisibility(
    formData.get("ranking_visibility"),
  );

  const questionIds = formData
    .getAll("question_id")
    .filter((value): value is string => typeof value === "string");

  if (
    !name ||
    name.length > MAX_GAME_NAME_LENGTH ||
    !classId ||
    !mode ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 30 ||
    durationSeconds > 3600 ||
    !rankingVisibility ||
    questionIds.length < 1 ||
    questionIds.length > 40
  ) {
    redirect("/dashboard/games?error=invalid");
  }

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (classError || !classRow) {
    redirect("/dashboard/games?error=invalid_class");
  }

  const uniqueQuestionIds = [...new Set(questionIds)];

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, question_bank_id")
    .in("id", uniqueQuestionIds);

  if (
    questionsError ||
    !questions ||
    questions.length !== uniqueQuestionIds.length
  ) {
    redirect("/dashboard/games?error=invalid_questions");
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      teacher_id: user.id,
      class_id: classId,
      name,
      game_type: "arabic_chase_race",
      mode,
      duration_seconds: durationSeconds,
      ranking_visibility: rankingVisibility,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    redirect("/dashboard/games?error=create_failed");
  }

  const explanationTiming: ExplanationTiming =
    mode === "learning" ? "after_each_question" : "never";

  const rows = uniqueQuestionIds.map((questionId, index) => ({
    game_id: game.id,
    question_id: questionId,
    position: index,
    explanation_timing: explanationTiming,
  }));

  const { error: relationError } = await supabase
    .from("game_questions")
    .insert(rows);

  if (relationError) {
    await supabase
      .from("games")
      .delete()
      .eq("id", game.id)
      .eq("teacher_id", user.id);

    redirect("/dashboard/games?error=create_failed");
  }

  revalidatePath("/dashboard/games");
  revalidatePath("/dashboard");
  redirect("/dashboard/games");
}

export async function startRoom(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const roomId = normalizeName(formData.get("room_id"));

  if (!roomId) {
    redirect("/dashboard/games?error=invalid_room");
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, state, game_id")
    .eq("id", roomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (
    roomError ||
    !room ||
    room.state !== "waiting" ||
    !room.game_id
  ) {
    redirect("/dashboard/games?error=invalid_room");
  }

  const now = new Date();

  const { error: updateError } = await supabase
    .from("rooms")
    .update({
      state: "running",
      started_at: now.toISOString(),
      current_question_index: 0,
      question_started_at: new Date(now.getTime() + 3000).toISOString(),
    })
    .eq("id", room.id)
    .eq("teacher_id", user.id)
    .eq("state", "waiting");

  if (updateError) {
    console.error("Room start failed:", updateError);
    redirect("/dashboard/games?error=room_start_failed");
  }

  revalidatePath("/dashboard/games");
  revalidatePath(`/dashboard/games/${room.game_id}/room`);

  redirect(`/dashboard/games/${room.game_id}/room?roomId=${room.id}`);
}
function generateUniqueRoomCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += alphabet[randomInt(0, alphabet.length)];
  }

  return code;
}

export async function createRoom(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const gameId = normalizeName(formData.get("game_id"));

  if (!gameId) {
    redirect("/dashboard/games?error=invalid_game");
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(
      "id, name, class_id, game_type, mode, duration_seconds, ranking_visibility",
    )
    .eq("id", gameId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (gameError || !game) {
    redirect("/dashboard/games?error=invalid_game");
  }

  const { data: gameQuestions, error: gameQuestionsError } = await supabase
    .from("game_questions")
    .select("id, question_id, position, explanation_timing")
    .eq("game_id", game.id)
    .order("position", { ascending: true });

  if (
    gameQuestionsError ||
    !gameQuestions ||
    gameQuestions.length < 1 ||
    gameQuestions.length > 40
  ) {
    redirect("/dashboard/games?error=invalid_questions");
  }

  const questionIds = gameQuestions.map((item) => item.question_id);

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select(
      "id, question_text, difficulty, correct_option_key, explanation, question_bank_id",
    )
    .in("id", questionIds);

  if (
    questionsError ||
    !questions ||
    questions.length !== questionIds.length
  ) {
    redirect("/dashboard/games?error=invalid_questions");
  }

  const { data: options, error: optionsError } = await supabase
    .from("question_options")
    .select("id, question_id, option_key, option_text")
    .in("question_id", questionIds)
    .order("option_key", { ascending: true });

  if (optionsError) {
    redirect("/dashboard/games?error=invalid_questions");
  }

  const { data: media, error: mediaError } = await supabase
    .from("question_media")
    .select(
      "id, question_id, media_type, expected_filename, storage_path, original_filename, mime_type, size_bytes, max_play_count, attached_at",
    )
    .in("question_id", questionIds)
    .order("created_at", { ascending: true });

  if (mediaError) {
    redirect("/dashboard/games?error=invalid_media");
  }

  const questionMap = new Map(
    questions.map((question) => [question.id, question]),
  );

  const optionsMap = new Map<string, typeof options>();

  for (const option of options ?? []) {
    const current = optionsMap.get(option.question_id) ?? [];
    current.push(option);
    optionsMap.set(option.question_id, current);
  }

  const mediaMap = new Map<string, typeof media>();

  for (const item of media ?? []) {
    const current = mediaMap.get(item.question_id) ?? [];
    current.push(item);
    mediaMap.set(item.question_id, current);
  }

  const snapshotQuestions = gameQuestions.map((gameQuestion) => {
    const question = questionMap.get(gameQuestion.question_id);

    if (!question) {
      throw new Error("Question missing from game snapshot.");
    }

    return {
      id: question.id,
      position: gameQuestion.position,
      explanation_timing: gameQuestion.explanation_timing,
      question_text: question.question_text,
      difficulty: question.difficulty,
      correct_option_key: question.correct_option_key,
      explanation: question.explanation,
      options: optionsMap.get(question.id) ?? [],
      media: mediaMap.get(question.id) ?? [],
    };
  });

  const snapshot = {
    version: 1,
    created_at: new Date().toISOString(),
    game: {
      id: game.id,
      name: game.name,
      class_id: game.class_id,
      game_type: game.game_type,
      mode: game.mode,
      duration_seconds: game.duration_seconds,
      ranking_visibility: game.ranking_visibility,
    },
    questions: snapshotQuestions,
  };

  let roomId: string | null = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateUniqueRoomCode();

    const { data: room, error: roomInsertError } = await supabase
      .from("rooms")
      .insert({
        code,
        teacher_id: user.id,
        game_id: game.id,
        class_id: game.class_id,
        state: "waiting",
        snapshot,
        capacity: 30,
      })
      .select("id")
      .single();

    if (!roomInsertError && room) {
      roomId = room.id;
      break;
    }

    if (roomInsertError?.code !== "23505") {
      console.error("Room creation failed:", roomInsertError);
      break;
    }
  }

  if (!roomId) {
    redirect("/dashboard/games?error=room_create_failed");
  }

  revalidatePath("/dashboard/games");
  revalidatePath(`/dashboard/games/${game.id}/room`);

  redirect(`/dashboard/games/${game.id}/room?roomId=${roomId}`);
}

