"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ExplanationTiming } from "@/types/database";

const MAX_GAME_NAME_LENGTH = 120;
const MEDIA_BUCKET = "question-media";

type GameMode = "competitive" | "learning";
type RankingVisibility = "full" | "hidden" | "self_only";

function normalizeName(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseGameMode(value: FormDataEntryValue | null): GameMode | null {
  if (value === "competitive") return "competitive";
  if (value === "learning") return "learning";
  return null;
}

function parseRankingVisibility(
  value: FormDataEntryValue | null,
): RankingVisibility | null {
  if (value === "full") return "full";
  if (value === "hidden") return "hidden";
  if (value === "self_only") return "self_only";
  return null;
}

export async function createGame(formData: FormData) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    console.error("[createGame] createClient failed:", e);
    redirect("/dashboard/games?error=client_failed");
  }

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
    redirect(
      `/dashboard/games?error=invalid_class&msg=${encodeURIComponent(classError?.message ?? "class_not_found")}`,
    );
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
    redirect(
      `/dashboard/games?error=invalid_questions&msg=${encodeURIComponent(questionsError?.message ?? "count_mismatch")}`,
    );
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
    console.error("[createGame] games insert failed:", gameError);
    redirect(
      `/dashboard/games?error=STEP_GAMES_INSERT&msg=${encodeURIComponent(gameError?.message ?? "no_data")}`,
    );
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
    console.error("[createGame] game_questions insert failed:", relationError);
    await supabase
      .from("games")
      .delete()
      .eq("id", game.id)
      .eq("teacher_id", user.id);

    redirect(
      `/dashboard/games?error=STEP_GAME_QUESTIONS_INSERT&msg=${encodeURIComponent(relationError.message)}`,
    );
  }

  revalidatePath("/dashboard/games");
  revalidatePath("/dashboard");
  redirect("/dashboard/games");
}

export async function deleteGame(formData: FormData) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    console.error("[deleteGame] createClient failed:", e);
    redirect("/dashboard/games?error=client_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const gameId = normalizeName(formData.get("game_id"));
  if (!gameId) redirect("/dashboard/games?error=invalid");

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id")
    .eq("id", gameId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (gameError || !game) {
    redirect("/dashboard/games?error=game_not_found");
  }

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id")
    .eq("game_id", gameId)
    .eq("teacher_id", user.id);

  const roomIds = (rooms ?? []).map((r) => r.id);

  if (roomIds.length > 0) {
    await supabase.from("submissions").delete().in("room_id", roomIds);
    await supabase.from("room_participants").delete().in("room_id", roomIds);
    await supabase.from("room_sessions").delete().in("room_id", roomIds);
    await supabase.from("rooms").delete().in("id", roomIds);
  }

  await supabase.from("game_questions").delete().eq("game_id", gameId);

  const { error: deleteError } = await supabase
    .from("games")
    .delete()
    .eq("id", gameId)
    .eq("teacher_id", user.id);

  if (deleteError) {
    console.error("[deleteGame] failed:", deleteError);
    redirect(
      `/dashboard/games?error=delete_failed&msg=${encodeURIComponent(deleteError.message)}`,
    );
  }

  revalidatePath("/dashboard/games");
  revalidatePath("/dashboard");
  redirect("/dashboard/games");
}

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createRoomCode() {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code +=
      ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

async function getUniqueRoomCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createRoomCode();
    const { data, error } = await supabase
      .from("rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return code;
  }

  throw new Error("room_code_unavailable");
}

export async function createRoom(formData: FormData) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    console.error("[createRoom] createClient failed:", e);
    redirect("/dashboard/games?error=client_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const gameId = normalizeName(formData.get("game_id"));
  if (!gameId) redirect("/dashboard/games?error=invalid");

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(
      "id, teacher_id, class_id, name, game_type, mode, duration_seconds, ranking_visibility",
    )
    .eq("id", gameId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (gameError || !game) {
    redirect(
      `/dashboard/games?error=invalid_game&msg=${encodeURIComponent(gameError?.message ?? "game_not_found")}`,
    );
  }

  const { data: existingRooms, error: existingRoomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("game_id", game.id)
    .eq("teacher_id", user.id)
    .in("state", ["waiting", "running"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingRoomError) {
    console.error("[createRoom] existing room query failed:", existingRoomError);
    redirect(
      `/dashboard/games?error=STEP_EXISTING_ROOM&msg=${encodeURIComponent(existingRoomError.message)}`,
    );
  }

  const existingRoom = existingRooms?.[0] ?? null;

  if (existingRoom) {
    redirect(`/dashboard/games/${game.id}/room?roomId=${existingRoom.id}`);
  }

  const { data: gameQuestions, error: gameQuestionsError } = await supabase
    .from("game_questions")
    .select("id, question_id, position, explanation_timing")
    .eq("game_id", game.id)
    .order("position", { ascending: true });

  if (gameQuestionsError || !gameQuestions?.length) {
    redirect(
      `/dashboard/games?error=invalid_questions&msg=${encodeURIComponent(gameQuestionsError?.message ?? "no_game_questions")}`,
    );
  }

  const questionIds = gameQuestions.map((item) => item.question_id);

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select(
      "id, question_bank_id, question_text, difficulty, correct_option_key, explanation",
    )
    .in("id", questionIds);

  if (questionsError || !questions || questions.length !== questionIds.length) {
    redirect(
      `/dashboard/games?error=invalid_questions&msg=${encodeURIComponent(questionsError?.message ?? "questions_count_mismatch")}`,
    );
  }

  const { data: options, error: optionsError } = await supabase
    .from("question_options")
    .select("id, question_id, option_key, option_text")
    .in("question_id", questionIds)
    .order("option_key", { ascending: true });

  if (optionsError) {
    console.error("[createRoom] options query failed:", optionsError);
    redirect(
      `/dashboard/games?error=STEP_OPTIONS&msg=${encodeURIComponent(optionsError.message)}`,
    );
  }

  const { data: media, error: mediaError } = await supabase
    .from("question_media")
    .select(
      "id, question_id, media_type, expected_filename, storage_path, original_filename, mime_type, size_bytes, max_play_count, attached_at",
    )
    .in("question_id", questionIds)
    .order("created_at", { ascending: true });

  if (mediaError) {
    console.error("[createRoom] media query failed:", mediaError);
    redirect(
      `/dashboard/games?error=STEP_MEDIA&msg=${encodeURIComponent(mediaError.message)}`,
    );
  }

  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const optionsByQuestion = new Map<string, NonNullable<typeof options>>();
  for (const option of options ?? []) {
    const current = optionsByQuestion.get(option.question_id) ?? [];
    current.push(option);
    optionsByQuestion.set(option.question_id, current);
  }

  const mediaByQuestion = new Map<
    string,
    Array<{
      id: string;
      media_type: string;
      public_url: string;
      mime_type: string | null;
      max_play_count: number | null;
    }>
  >();

  for (const item of media ?? []) {
    if (!item.storage_path) {
      console.warn(
        "[createRoom] skip media tanpa storage_path:",
        item.id,
        item.question_id,
      );
      continue;
    }

    const publicUrl = supabase.storage
      .from(MEDIA_BUCKET)
      .getPublicUrl(item.storage_path).data.publicUrl;

    const current = mediaByQuestion.get(item.question_id) ?? [];
    current.push({
      id: item.id,
      media_type: item.media_type,
      public_url: publicUrl,
      mime_type: item.mime_type,
      max_play_count: item.max_play_count ?? null,
    });
    mediaByQuestion.set(item.question_id, current);
  }

  const snapshotQuestions = gameQuestions.map((gameQuestion) => {
    const question = questionById.get(gameQuestion.question_id);
    if (!question) throw new Error("invalid_question_snapshot");

    return {
      position: gameQuestion.position,
      explanation_timing: gameQuestion.explanation_timing,
      question: {
        id: question.id,
        question_bank_id: question.question_bank_id,
        question_text: question.question_text,
        difficulty: question.difficulty,
        correct_option_key: question.correct_option_key,
        explanation: question.explanation,
        options: optionsByQuestion.get(question.id) ?? [],
        media: mediaByQuestion.get(question.id) ?? [],
      },
    };
  });

  let code = "";
  try {
    code = await getUniqueRoomCode(supabase);
  } catch (e) {
    console.error("[createRoom] room code generation failed:", e);
    redirect(
      `/dashboard/games?error=STEP_ROOM_CODE&msg=${encodeURIComponent(e instanceof Error ? e.message : "unknown")}`,
    );
  }

  const snapshot = {
    version: 1,
    created_at: new Date().toISOString(),
    game: {
      id: game.id,
      name: game.name,
      game_type: game.game_type,
      mode: game.mode,
      duration_seconds: game.duration_seconds,
      ranking_visibility: game.ranking_visibility,
      class_id: game.class_id,
    },
    questions: snapshotQuestions,
  };

  const { data: room, error: roomError } = await supabase
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

  if (roomError || !room) {
    console.error("[createRoom] rooms insert failed:", roomError);
    redirect(
      `/dashboard/games?error=STEP_ROOMS_INSERT&msg=${encodeURIComponent(roomError?.message ?? "no_data")}`,
    );
  }

  revalidatePath("/dashboard/games");
  revalidatePath(`/dashboard/games/${game.id}/room`);
  redirect(`/dashboard/games/${game.id}/room?roomId=${room.id}`);
}

export async function deleteRoom(formData: FormData) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    console.error("[deleteRoom] createClient failed:", e);
    redirect("/dashboard/games?error=client_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const roomId = normalizeName(formData.get("room_id"));
  const gameId = normalizeName(formData.get("game_id"));

  if (!roomId) redirect("/dashboard/games?error=invalid");

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (roomError || !room) {
    redirect("/dashboard/games?error=room_not_found");
  }

  await supabase.from("submissions").delete().eq("room_id", roomId);
  await supabase.from("room_participants").delete().eq("room_id", roomId);
  await supabase.from("room_sessions").delete().eq("room_id", roomId);

  const { error: deleteError } = await supabase
    .from("rooms")
    .delete()
    .eq("id", roomId)
    .eq("teacher_id", user.id);

  if (deleteError) {
    console.error("[deleteRoom] failed:", deleteError);
    redirect(
      `/dashboard/games?error=delete_failed&msg=${encodeURIComponent(deleteError.message)}`,
    );
  }

  revalidatePath("/dashboard/games");
  if (gameId) revalidatePath(`/dashboard/games/${gameId}/room`);
  redirect("/dashboard/games");
}

export async function startRoom(formData: FormData) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    console.error("[startRoom] createClient failed:", e);
    redirect("/dashboard/games?error=client_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const roomId = normalizeName(formData.get("room_id"));
  if (!roomId) redirect("/dashboard/games?error=invalid");

  const now = new Date();
  const { data: room, error } = await supabase
    .from("rooms")
    .update({
      state: "running",
      started_at: now.toISOString(),
      current_question_index: 0,
      question_started_at: new Date(now.getTime() + 3000).toISOString(),
    })
    .eq("id", roomId)
    .eq("teacher_id", user.id)
    .eq("state", "waiting")
    .select("id, game_id")
    .maybeSingle();

  if (error || !room) {
    redirect(
      `/dashboard/games?error=room_start_failed&msg=${encodeURIComponent(error?.message ?? "no_room")}`,
    );
  }

  revalidatePath(`/dashboard/games/${room.game_id}/room`);
  redirect(`/dashboard/games/${room.game_id}/room?roomId=${room.id}`);
}

export async function archiveRoomSession(formData: FormData) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    console.error("[archiveRoomSession] createClient failed:", e);
    redirect("/dashboard/games?error=client_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const roomId = normalizeName(formData.get("room_id"));
  const gameId = normalizeName(formData.get("game_id"));

  if (!roomId || !gameId) {
    redirect("/dashboard/games?error=invalid");
  }

  const { error } = await supabase.rpc("archive_room_session", {
    p_room_id: roomId,
  });

  if (error) {
    console.error("[archiveRoomSession] failed:", error);
    redirect(
      `/dashboard/games/${gameId}/room?roomId=${roomId}&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/games/${gameId}/room`);
  redirect(`/dashboard/games/${gameId}/room?roomId=${roomId}&archived=1`);
}