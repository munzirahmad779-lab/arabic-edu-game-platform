import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createGame, createRoom, deleteGame } from "./actions";
import { GameModeSelector } from "./game-mode-selector";
import { QuestionsPicker } from "./questions-picker";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SearchParams = {
  error?: string;
  msg?: string;
};

// Mode -> apakah butuh room
const MODE_FOR_ROOM: Record<string, boolean> = {
  competitive: true,
  cooperative: true,
  endless: false,
  practice: false,
  learning: true,
  anagram: true,
  matching: true,
};

// Mode -> key dictionary untuk label
const MODE_LABEL_KEY: Record<string, string> = {
  competitive: "mode_competitive",
  cooperative: "mode_cooperative",
  endless: "mode_endless",
  practice: "mode_practice",
  learning: "mode_learning",
  anagram: "mode_anagram",
  matching: "mode_matching",
};

export default async function GamesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const t = dict.games_page;

  const [
    { data: classes },
    { data: banks },
    { data: games },
    { data: audioTracks },
    { data: categories },
    { data: questions },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("name"),
    supabase
      .from("question_banks")
      .select("id, name, description, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("games")
      .select(
        "id, name, class_id, game_type, mode, duration_seconds, ranking_visibility, backsound_track_id, created_at",
      )
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_audio_tracks")
      .select("id, name, enabled")
      .eq("teacher_id", user.id)
      .eq("enabled", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("question_categories")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("questions")
      .select("id, question_bank_id, question_text, difficulty, category_id")
      .eq("teacher_id", user.id)
      .not("question_bank_id", "is", null)
      .order("created_at", { ascending: true }),
  ]);

  const tracks = audioTracks ?? [];
  const categoriesList = categories ?? [];
  const classList = classes ?? [];
  const bankList = banks ?? [];
  const gameList = games ?? [];

  const questionsByBank: Record<
    string,
    Array<{
      id: string;
      question_text: string | null;
      difficulty: "easy" | "medium" | "hard" | null;
      category_id: string | null;
    }>
  > = {};
  for (const q of questions ?? []) {
    if (!q.question_bank_id) continue;
    if (!questionsByBank[q.question_bank_id]) {
      questionsByBank[q.question_bank_id] = [];
    }
    questionsByBank[q.question_bank_id].push({
      id: q.id,
      question_text: q.question_text,
      difficulty: q.difficulty,
      category_id: q.category_id,
    });
  }

  const getModeLabel = (mode: string) => {
    const key = (MODE_LABEL_KEY[mode] ?? "mode_competitive") as keyof typeof t;
    return t[key] ?? mode;
  };

  const isForRoom = (mode: string) =>
    MODE_FOR_ROOM[mode] ?? MODE_FOR_ROOM.competitive;

  return (
    <main className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-terracotta-500">
            {dict.common.brand_top}
          </p>
          <h1 className="font-display mt-1 text-3xl font-black tracking-tight text-teal-700">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-softslate/80">{t.subtitle}</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 transition hover:bg-sage-50"
        >
          {t.back}
        </Link>
      </header>

      {searchParams.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {searchParams.error}
          {searchParams.msg ? (
            <div className="mt-1 text-xs opacity-80">{searchParams.msg}</div>
          ) : null}
        </div>
      ) : null}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-teal-700">
              {t.my_games}
            </h2>
            <p className="mt-1 text-sm text-softslate/70">
              {t.my_games_desc}
            </p>
          </div>
          <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-bold text-terracotta-600">
            {gameList.length}
          </span>
        </div>

        {gameList.length === 0 ? (
          <div className="aesthetic-card text-center text-sm text-softslate/70">
            {t.no_games}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gameList.map((game) => {
              const className =
                classList.find((item) => item.id === game.class_id)?.name ??
                "—";
              const isRoom = isForRoom(game.mode);
              const hasBacksound = Boolean(game.backsound_track_id);
              const isTimed =
                game.mode === "competitive" ||
                game.mode === "cooperative" ||
                game.mode === "learning";
              const durationMinutes = Math.round(game.duration_seconds / 60);

              return (
                <article key={game.id} className="aesthetic-card flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display truncate text-lg font-black text-teal-700">
                        {game.name}
                      </h3>
                      <p className="mt-1 truncate text-sm text-softslate/70">
                        {className}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-terracotta-100 px-2 py-1 font-bold text-terracotta-600">
                      {getModeLabel(game.mode)}
                    </span>
                    {isTimed ? (
                      <span className="rounded-full bg-teal-100 px-2 py-1 font-bold text-teal-700">
                        {durationMinutes} {t.duration_min}
                      </span>
                    ) : (
                      <span className="rounded-full bg-sage-100 px-2 py-1 font-bold text-sage-600">
                        ∞
                      </span>
                    )}
                    {hasBacksound ? (
                      <span className="rounded-full bg-sage-100 px-2 py-1 font-bold text-sage-600">
                        🎵
                      </span>
                    ) : null}
                  </div>

                  {!isRoom ? (
                    <p className="mt-2 rounded-xl bg-teal-50 px-2 py-1.5 text-[11px] font-bold text-teal-700">
                      {t.self_practice}
                    </p>
                  ) : null}

                  <div className="mt-4 flex gap-2 pt-2">
                    {isRoom ? (
                      <form action={createRoom} className="flex-1">
                        <input type="hidden" name="game_id" value={game.id} />
                        <button
                          type="submit"
                          className="w-full rounded-full bg-terracotta-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-terracotta-600"
                        >
                          {t.play}
                        </button>
                      </form>
                    ) : (
                      <div className="flex-1 rounded-full border border-dashed border-teal-200 bg-teal-50 px-4 py-2.5 text-center text-xs font-bold text-teal-700">
                        {t.no_room}
                      </div>
                    )}

                    <form action={deleteGame}>
                      <input type="hidden" name="game_id" value={game.id} />
                      <button
                        type="submit"
                        title={t.delete_title}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                      >
                        🗑
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="aesthetic-card">
        <div>
          <h2 className="font-display text-lg font-black text-teal-700">
            {t.create_title}
          </h2>
          <p className="mt-1 text-sm text-softslate/70">{t.create_desc}</p>
        </div>

        {classList.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-terracotta-500/25 bg-terracotta-50 p-4 text-sm text-terracotta-600">
            {t.no_class_warn}
          </div>
        ) : bankList.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-terracotta-500/25 bg-terracotta-50 p-4 text-sm text-terracotta-600">
            {t.no_bank_warn}
          </div>
        ) : (
          <form action={createGame} className="mt-6 space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label
                  htmlFor="game-name"
                  className="block text-sm font-bold text-teal-700"
                >
                  {t.label_name}
                </label>
                <input
                  id="game-name"
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
                />
              </div>

              <div>
                <label
                  htmlFor="class-id"
                  className="block text-sm font-bold text-teal-700"
                >
                  {t.label_class}
                </label>
                <select
                  id="class-id"
                  name="class_id"
                  required
                  defaultValue=""
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="" disabled>
                    {t.choose_class}
                  </option>
                  {classList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ranking-visibility"
                  className="block text-sm font-bold text-teal-700"
                >
                  {t.label_ranking}
                </label>
                <select
                  id="ranking-visibility"
                  name="ranking_visibility"
                  defaultValue="full"
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="full">{t.ranking_full}</option>
                  <option value="hidden">{t.ranking_hidden}</option>
                  <option value="self_only">{t.ranking_self}</option>
                </select>
              </div>

              <GameModeSelector
                tracks={tracks.map((tr) => ({ id: tr.id, name: tr.name }))}
                gm={dict.game_mode}
              />
            </div>

            <QuestionsPicker
              banks={bankList.map((b) => ({
                id: b.id,
                name: b.name,
                description: b.description,
              }))}
              categories={categoriesList}
              questionsByBank={questionsByBank}
              qp={dict.questions_picker}
            />

            <button
              type="submit"
              className="w-full rounded-full bg-terracotta-500 px-5 py-3 text-sm font-black text-white transition hover:bg-terracotta-600"
            >
              {t.btn_create}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}