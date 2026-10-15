import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameRegistry } from "@/lib/game-engine/registry";
import { ProjectorScreen } from "./projector-screen";
import { WebGameEmbedPlayer } from "@/components/game-players/web-embed-player";
import type { RawOption, RawQuestion } from "@/lib/game-engine/types";

export const metadata = {
  title: "Mode Proyektor (Hot Seat) - Magguru",
};

export default async function ProjectorPage({
  params,
  searchParams,
}: {
  params: { gameId: string };
  searchParams?: { roomId?: string };
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

  // 1b. Fetch active room (if any) to synchronize room code and live online joined participants
  let activeRoomCode: string | null = null;
  const targetRoomId = searchParams?.roomId?.trim();

  let roomQuery = supabase
    .from("rooms")
    .select("id, code")
    .eq("game_id", params.gameId)
    .eq("teacher_id", user.id);

  if (targetRoomId) {
    roomQuery = roomQuery.eq("id", targetRoomId);
  } else {
    roomQuery = roomQuery.order("created_at", { ascending: false }).limit(1);
  }

  const { data: roomData } = await roomQuery.maybeSingle();
  let onlineStudents: Array<{ id: string; name: string; class_id: string; class_name: string }> = [];

  if (roomData) {
    activeRoomCode = roomData.code;
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: pData } = await supabase
      .from("room_participants")
      .select("id, student_id, guest_name")
      .eq("room_id", roomData.id)
      .gte("last_seen_at", cutoff);

    if (pData && pData.length > 0) {
      onlineStudents = pData.map((p, idx) => ({
        id: p.id,
        name: p.guest_name || `Murid Online #${idx + 1}`,
        class_id: "room-online",
        class_name: `Peserta Room (${roomData.code})`,
      }));
    }
  }

  // 2. Fetch all classes and students for this teacher
  const { data: classesData } = await supabase
    .from("classes")
    .select("id, name, subject")
    .eq("teacher_id", user.id)
    .order("name", { ascending: true });

  const teacherClasses = [...(classesData ?? [])];
  if (onlineStudents.length > 0) {
    teacherClasses.unshift({
      id: "room-online",
      name: `📡 Peserta Online Room (${activeRoomCode})`,
      subject: "Online Join",
    });
  }

  const classIds = (classesData ?? []).map((c) => c.id);

  let allStudents: Array<{ id: string; name: string; class_id: string; class_name: string }> = [
    ...onlineStudents,
  ];
  if (classIds.length > 0) {
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, name, class_id")
      .in("class_id", classIds)
      .order("name", { ascending: true });

    if (studentsData) {
      const classNameMap = new Map((classesData ?? []).map((c) => [c.id, c.name]));
      const registeredStudents = studentsData.map((s) => ({
        id: s.id,
        name: s.name,
        class_id: s.class_id,
        class_name: classNameMap.get(s.class_id) ?? "Kelas",
      }));
      allStudents = [...allStudents, ...registeredStudents];
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

  // Check if this game is an embedded web game (Wordwall / Educaplay / H5P / Quizizz)
  const embedMatch = game.name.match(/\[EMBED:(.*?)\]/);
  if (embedMatch && embedMatch[1]) {
    const embedUrl = embedMatch[1].trim();
    const cleanTitle = game.name.replace(/\[EMBED:.*?\]/, "").trim();
    return <WebGameEmbedPlayer embedUrl={embedUrl} title={cleanTitle} />;
  }

  const themeMatch = game.name.match(/\[THEME:(.*?)\]/);
  const cleanTitle = game.name.replace(/\[(THEME|EMBED):.*?\]/, "").trim();
  const initialGameType = GameRegistry.resolve(game.game_type, game.mode);
  const initialGameTheme = themeMatch ? themeMatch[1] : (game.game_type || "kahoot");

  return (
    <ProjectorScreen
      gameId={game.id}
      gameName={cleanTitle}
      initialGameType={initialGameType}
      initialGameTheme={initialGameTheme}
      questions={rawQuestions}
      allStudents={allStudents}
      teacherClasses={teacherClasses}
      defaultClassId={game.class_id || teacherClasses[0]?.id || ""}
      initialRoomCode={activeRoomCode}
    />
  );
}
