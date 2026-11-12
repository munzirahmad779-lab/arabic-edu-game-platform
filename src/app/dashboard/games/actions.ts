"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameRegistry } from "@/lib/game-engine/registry";
import {
  ActiveRoomStore,
  hasCompleteMultipleChoiceOptions,
} from "@/lib/game-engine/room-store";
import {
  embedUrlRejectMessage,
  validateEmbedUrl,
} from "@/lib/game-engine/embed-url";
import type { ExplanationTiming } from "@/types/database";

const MAX_GAME_NAME_LENGTH = 120;
const MEDIA_BUCKET = "question-media";

type GameMode = "competitive" | "cooperative" | "endless" | "practice" | "learning" | "anagram" | "matching";
type RankingVisibility = "full" | "hidden" | "self_only";

function normalizeName(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseGameMode(value: FormDataEntryValue | null): GameMode | null {
  if (value === "competitive") return "competitive";
  if (value === "cooperative") return "cooperative";
  if (value === "endless") return "endless";
  if (value === "practice") return "practice";
  if (value === "learning") return "learning";
  if (value === "anagram") return "anagram";
  if (value === "matching") return "matching";
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

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ParsedGameForm = {
  name: string;
  classId: string;
  mode: GameMode;
  durationSeconds: number;
  rankingVisibility: RankingVisibility;
  backsoundTrackIdRaw: string;
  uniqueQuestionIds: string[];
};

/**
 * Mengurai dan memvalidasi kolom formulir permainan. Dipakai bersama
 * oleh createGame dan updateGame supaya validasi ubah tidak pernah
 * tertinggal dari validasi buat. Setiap kegagalan mengalihkan ke
 * errorBase dengan kode galat spesifik (bukan satu kode "invalid"
 * untuk semua penyebab).
 */
function parseGameFormFields(
  formData: FormData,
  errorBase: string,
): ParsedGameForm {
  const name = normalizeName(formData.get("name"));
  const classId = normalizeName(formData.get("class_id"));
  const mode = parseGameMode(formData.get("mode"));
  const isTimedMode =
    mode === "competitive" || mode === "cooperative" || mode === "learning";
  const durationMinutes = isTimedMode
    ? Number(formData.get("duration_minutes"))
    : 5;
  const rankingVisibility = parseRankingVisibility(
    formData.get("ranking_visibility"),
  );
  const backsoundTrackIdRaw = normalizeName(formData.get("backsound_track_id"));

  const questionIds = formData
    .getAll("question_id")
    .filter((value): value is string => typeof value === "string");

  if (!name || name.length > MAX_GAME_NAME_LENGTH) {
    redirect(`${errorBase}?error=invalid_name`);
  }
  if (!classId) {
    redirect(`${errorBase}?error=invalid_class&msg=class_required`);
  }
  if (!mode || !rankingVisibility) {
    redirect(`${errorBase}?error=invalid`);
  }
  if (
    isTimedMode &&
    (!Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 60)
  ) {
    redirect(`${errorBase}?error=invalid_duration`);
  }
  if (questionIds.length < 1) {
    redirect(`${errorBase}?error=no_questions`);
  }
  if (questionIds.length > 140) {
    redirect(`${errorBase}?error=too_many_questions`);
  }

  return {
    name,
    classId,
    mode,
    durationSeconds: durationMinutes * 60,
    rankingVisibility,
    backsoundTrackIdRaw,
    uniqueQuestionIds: [...new Set(questionIds)],
  };
}

async function assertClassOwned(
  supabase: SupabaseServerClient,
  userId: string,
  classId: string,
  errorBase: string,
) {
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", userId)
    .maybeSingle();

  if (classError || !classRow) {
    redirect(
      `${errorBase}?error=invalid_class&msg=${encodeURIComponent(classError?.message ?? "class_not_found")}`,
    );
  }
}

async function assertQuestionsExist(
  supabase: SupabaseServerClient,
  uniqueQuestionIds: string[],
  errorBase: string,
  teacherId: string,
) {
  // Filter pemilik eksplisit sebagai pertahanan berlapis di atas RLS:
  // soal guru lain harus terbaca sebagai tidak ada.
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, question_bank_id")
    .in("id", uniqueQuestionIds)
    .eq("teacher_id", teacherId);

  if (
    questionsError ||
    !questions ||
    questions.length !== uniqueQuestionIds.length
  ) {
    redirect(
      `${errorBase}?error=invalid_questions&msg=${encodeURIComponent(questionsError?.message ?? "count_mismatch")}`,
    );
  }
}

async function resolveBacksoundTrackId(
  supabase: SupabaseServerClient,
  userId: string,
  backsoundTrackIdRaw: string,
  errorBase: string,
): Promise<string | null> {
  if (!backsoundTrackIdRaw) return null;

  if (!/^[0-9a-f-]{36}$/i.test(backsoundTrackIdRaw)) {
    redirect(`${errorBase}?error=invalid&msg=invalid_backsound`);
  }
  const { data: track } = await supabase
    .from("teacher_audio_tracks")
    .select("id")
    .eq("id", backsoundTrackIdRaw)
    .eq("teacher_id", userId)
    .maybeSingle();
  if (!track) {
    redirect(`${errorBase}?error=invalid&msg=invalid_backsound`);
  }
  return track.id;
}

function resolveGameType(
  formData: FormData,
  mode: GameMode,
  errorBase: string,
): ReturnType<typeof GameRegistry.resolve> {
  const gameTypeRaw = normalizeName(formData.get("game_type"));
  const gameType = GameRegistry.resolve(gameTypeRaw, mode);

  const isEngineMode =
    mode === "competitive" ||
    mode === "cooperative" ||
    mode === "endless" ||
    mode === "practice" ||
    mode === "learning";

  if (isEngineMode && !GameRegistry.isModeSupported(gameType, mode)) {
    redirect(
      `${errorBase}?error=invalid_mode_for_game_type&msg=${encodeURIComponent(`Mode "${mode}" tidak didukung untuk tipe game "${gameType}"`)}`,
    );
  }

  return gameType;
}

/**
 * Menyusun nama final permainan termasuk token tema/embed. URL embed
 * divalidasi di pintu masuk: hanya https dan format sah yang boleh
 * tersimpan. Tanpa ini, URL rusak/http tersimpan diam-diam dan baru
 * ketahuan sebagai bingkai kosong di kelas.
 */
function buildFinalGameName(
  name: string,
  formData: FormData,
  errorBase: string,
): string {
  const gameThemeRaw = normalizeName(formData.get("game_theme"));
  let finalGameName = name;
  if (gameThemeRaw && gameThemeRaw !== "kahoot") {
    if (gameThemeRaw.startsWith("embed:")) {
      const embedRaw = gameThemeRaw.replace(/^embed:/, "");
      const embedValidation = validateEmbedUrl(embedRaw);
      if (!embedValidation.ok) {
        redirect(
          `${errorBase}?error=invalid_embed_url&msg=${encodeURIComponent(embedUrlRejectMessage(embedValidation.reason))}`,
        );
      }
      finalGameName = `${name} [EMBED:${embedValidation.url}]`;
    } else {
      finalGameName = `${name} [THEME:${gameThemeRaw}]`;
    }
  }
  return finalGameName;
}

function explanationTimingForMode(mode: GameMode): ExplanationTiming {
  // - competitive: never
  // - cooperative: after_each_question (belajar santai)
  // - endless/practice: after_each_question (untuk belajar mandiri)
  return mode === "cooperative" ||
    mode === "learning" ||
    mode === "endless" ||
    mode === "practice"
    ? "after_each_question"
    : "never";
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

  const {
    name,
    classId,
    mode,
    durationSeconds,
    rankingVisibility,
    backsoundTrackIdRaw,
    uniqueQuestionIds,
  } = parseGameFormFields(formData, "/dashboard/games");

  await assertClassOwned(supabase, user.id, classId, "/dashboard/games");
  await assertQuestionsExist(supabase, uniqueQuestionIds, "/dashboard/games", user.id);

  // Backsound opsional
  const backsoundTrackId = await resolveBacksoundTrackId(
    supabase,
    user.id,
    backsoundTrackIdRaw,
    "/dashboard/games",
  );

  const gameType = resolveGameType(formData, mode, "/dashboard/games");
  const finalGameName = buildFinalGameName(name, formData, "/dashboard/games");

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      teacher_id: user.id,
      class_id: classId,
      name: finalGameName,
      game_type: gameType,
      mode,
      duration_seconds: durationSeconds,
      ranking_visibility: rankingVisibility,
      backsound_track_id: backsoundTrackId,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    console.error("[createGame] games insert failed:", gameError);
    redirect(
      `/dashboard/games?error=STEP_GAMES_INSERT&msg=${encodeURIComponent(gameError?.message ?? "no_data")}`,
    );
  }

  const explanationTiming = explanationTimingForMode(mode);

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

/**
 * Mengubah permainan yang sudah ada. Selama ini edit tidak ada sama
 * sekali: satu-satunya jalan mengubah game adalah kloning atau hapus
 * lalu buat ulang. Validasi memakai pengurai yang sama persis dengan
 * createGame (parseGameFormFields dan kawan-kawannya), dan daftar
 * soal diganti utuh. Bila penulisan daftar soal baru gagal, daftar
 * soal lama dipulihkan dari salinan yang diambil sebelum penghapusan.
 */
export async function updateGame(formData: FormData) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    console.error("[updateGame] createClient failed:", e);
    redirect("/dashboard/games?error=client_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const gameId = normalizeName(formData.get("game_id"));
  if (!gameId) {
    redirect("/dashboard/games?error=game_not_found");
  }

  const errorBase = `/dashboard/games/${gameId}`;

  const { data: existingGame, error: existingError } = await supabase
    .from("games")
    .select("id")
    .eq("id", gameId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (existingError || !existingGame) {
    redirect("/dashboard/games?error=game_not_found");
  }

  const {
    name,
    classId,
    mode,
    durationSeconds,
    rankingVisibility,
    backsoundTrackIdRaw,
    uniqueQuestionIds,
  } = parseGameFormFields(formData, errorBase);

  await assertClassOwned(supabase, user.id, classId, errorBase);
  await assertQuestionsExist(supabase, uniqueQuestionIds, errorBase, user.id);

  const backsoundTrackId = await resolveBacksoundTrackId(
    supabase,
    user.id,
    backsoundTrackIdRaw,
    errorBase,
  );

  const gameType = resolveGameType(formData, mode, errorBase);
  const finalGameName = buildFinalGameName(name, formData, errorBase);

  // Salinan daftar soal lama untuk pemulihan bila penulisan gagal.
  const { data: oldQuestionRows } = await supabase
    .from("game_questions")
    .select("question_id, position, explanation_timing")
    .eq("game_id", gameId)
    .order("position", { ascending: true });

  const { error: updateError } = await supabase
    .from("games")
    .update({
      class_id: classId,
      name: finalGameName,
      game_type: gameType,
      mode,
      duration_seconds: durationSeconds,
      ranking_visibility: rankingVisibility,
      backsound_track_id: backsoundTrackId,
    })
    .eq("id", gameId)
    .eq("teacher_id", user.id);

  if (updateError) {
    console.error("[updateGame] games update failed:", updateError);
    redirect(
      `${errorBase}?error=update_failed&msg=${encodeURIComponent(updateError.message)}`,
    );
  }

  const explanationTiming = explanationTimingForMode(mode);
  const newRows = uniqueQuestionIds.map((questionId, index) => ({
    game_id: gameId,
    question_id: questionId,
    position: index,
    explanation_timing: explanationTiming,
  }));

  const { error: deleteRelationError } = await supabase
    .from("game_questions")
    .delete()
    .eq("game_id", gameId);

  if (deleteRelationError) {
    console.error("[updateGame] game_questions delete failed:", deleteRelationError);
    redirect(
      `${errorBase}?error=update_failed&msg=${encodeURIComponent(deleteRelationError.message)}`,
    );
  }

  const { error: relationError } = await supabase
    .from("game_questions")
    .insert(newRows);

  if (relationError) {
    console.error(
      "[updateGame] game_questions insert failed, memulihkan daftar lama:",
      relationError,
    );
    if (oldQuestionRows && oldQuestionRows.length > 0) {
      await supabase.from("game_questions").insert(
        oldQuestionRows.map((row) => ({
          game_id: gameId,
          question_id: row.question_id,
          position: row.position,
          explanation_timing: row.explanation_timing,
        })),
      );
    }
    redirect(
      `${errorBase}?error=update_failed&msg=${encodeURIComponent(relationError.message)}`,
    );
  }

  revalidatePath("/dashboard/games");
  revalidatePath(errorBase);
  revalidatePath(`/dashboard/games/${gameId}/projector`);
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

  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id")
    .eq("game_id", gameId)
    .eq("teacher_id", user.id);

  if (roomsError) {
    console.error("[deleteGame] rooms lookup failed:", roomsError);
    redirect(
      `/dashboard/games?error=delete_failed&msg=${encodeURIComponent(roomsError.message)}`,
    );
  }

  const roomIds = (rooms ?? []).map((r) => r.id);

  // Rantai hapus wajib diperiksa satu per satu: kegagalan di tengah
  // tidak boleh tertutup oleh redirect sukses di akhir.
  if (roomIds.length > 0) {
    const chain: Array<{ error: { message: string } | null }> = [];
    chain.push(await supabase.from("submissions").delete().in("room_id", roomIds));
    chain.push(await supabase.from("room_participants").delete().in("room_id", roomIds));
    chain.push(await supabase.from("room_sessions").delete().in("room_id", roomIds));
    chain.push(await supabase.from("rooms").delete().in("id", roomIds));
    const chainError = chain.find((r) => r.error)?.error;
    if (chainError) {
      console.error("[deleteGame] room chain delete failed:", chainError);
      redirect(
        `/dashboard/games?error=delete_failed&msg=${encodeURIComponent(chainError.message)}`,
      );
    }
  }

  const { error: questionsError } = await supabase
    .from("game_questions")
    .delete()
    .eq("game_id", gameId);
  if (questionsError) {
    console.error("[deleteGame] game_questions delete failed:", questionsError);
    redirect(
      `/dashboard/games?error=delete_failed&msg=${encodeURIComponent(questionsError.message)}`,
    );
  }

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

export async function cloneGame(formData: FormData) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    console.error("[cloneGame] createClient failed:", e);
    redirect("/dashboard/games?error=client_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const gameId = normalizeName(formData.get("game_id"));
  if (!gameId) redirect("/dashboard/games?error=invalid");

  const { data: sourceGame, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (gameError || !sourceGame) {
    redirect("/dashboard/games?error=game_not_found");
  }

  const { data: sourceQuestions, error: qError } = await supabase
    .from("game_questions")
    .select("question_id, position, explanation_timing")
    .eq("game_id", gameId)
    .order("position", { ascending: true });

  if (qError || !sourceQuestions || sourceQuestions.length === 0) {
    redirect("/dashboard/games?error=invalid_questions");
  }

  const clonedName = `${sourceGame.name} (Salinan)`.slice(0, MAX_GAME_NAME_LENGTH);

  const { data: clonedGame, error: insertError } = await supabase
    .from("games")
    .insert({
      teacher_id: user.id,
      class_id: sourceGame.class_id,
      name: clonedName,
      game_type: sourceGame.game_type,
      mode: sourceGame.mode,
      duration_seconds: sourceGame.duration_seconds,
      ranking_visibility: sourceGame.ranking_visibility,
      backsound_track_id: sourceGame.backsound_track_id,
    })
    .select("id")
    .single();

  if (insertError || !clonedGame) {
    console.error("[cloneGame] insert failed:", insertError);
    redirect("/dashboard/games?error=create_failed");
  }

  const newQuestions = sourceQuestions.map((sq) => ({
    game_id: clonedGame.id,
    question_id: sq.question_id,
    position: sq.position,
    explanation_timing: sq.explanation_timing,
  }));

  const { error: relError } = await supabase
    .from("game_questions")
    .insert(newQuestions);

  if (relError) {
    console.error("[cloneGame] game_questions insert failed:", relError);
    await supabase
      .from("games")
      .delete()
      .eq("id", clonedGame.id)
      .eq("teacher_id", user.id);
    redirect("/dashboard/games?error=create_failed");
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
      "id, teacher_id, class_id, name, game_type, mode, duration_seconds, ranking_visibility, backsound_track_id",
    )
    .eq("id", gameId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (gameError || !game) {
    redirect(
      `/dashboard/games?error=invalid_game&msg=${encodeURIComponent(gameError?.message ?? "game_not_found")}`,
    );
  }

  // Endless & Practice hanya untuk portal siswa (self-practice), bukan room.
  if (game.mode === "endless" || game.mode === "practice") {
    redirect(`/dashboard/games?error=invalid_mode`);
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

  // A standard room quiz must deliver the real A/B/C/D choices. Do not create
  // a room that would force the student/projector UI to invent placeholders.
  const requiresFourChoices =
    game.mode !== "anagram" &&
    game.mode !== "matching" &&
    game.game_type !== "anagram";
  if (
    requiresFourChoices &&
    questionIds.some(
      (questionId) =>
        !hasCompleteMultipleChoiceOptions(optionsByQuestion.get(questionId)),
    )
  ) {
    redirect(
      "/dashboard/games?error=invalid_options&msg=Setiap+soal+room+harus+memiliki+pilihan+A%2C+B%2C+C%2C+D+yang+terisi.",
    );
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
      backsound_track_id: game.backsound_track_id,
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

  ActiveRoomStore.registerRoom({
    id: room.id,
    code,
    game_name: game.name,
    game_type: game.game_type,
    game_mode: game.mode,
    duration_seconds: game.duration_seconds,
    capacity: 30,
    state: "waiting",
    questions: snapshotQuestions,
  });

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

  // Rantai hapus wajib diperiksa satu per satu, sama seperti deleteGame.
  const chain: Array<{ error: { message: string } | null }> = [];
  chain.push(await supabase.from("submissions").delete().eq("room_id", roomId));
  chain.push(await supabase.from("room_participants").delete().eq("room_id", roomId));
  chain.push(await supabase.from("room_sessions").delete().eq("room_id", roomId));
  const chainError = chain.find((r) => r.error)?.error;
  if (chainError) {
    console.error("[deleteRoom] chain delete failed:", chainError);
    redirect(
      `/dashboard/games?error=delete_failed&msg=${encodeURIComponent(chainError.message)}`,
    );
  }

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
    .select("id, game_id, code")
    .maybeSingle();

  if (error || !room) {
    redirect(
      `/dashboard/games?error=room_start_failed&msg=${encodeURIComponent(error?.message ?? "no_room")}`,
    );
  }

  const { data: gameRow } = room.game_id
    ? await supabase
        .from("games")
        .select("name")
        .eq("id", room.game_id)
        .maybeSingle()
    : { data: null };

  ActiveRoomStore.registerRoom({
    id: room.id,
    code: room.code ?? "",
    game_name: gameRow?.name ?? "",
    state: "running",
    started_at: now.toISOString(),
    question_started_at: new Date(now.getTime() + 3000).toISOString(),
    current_question_index: 0,
  });

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
