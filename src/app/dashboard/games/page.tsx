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

const MODE_LABEL_KEY: Record<
  string,
  { ar: string; en: string; id: string; forRoom: boolean }
> = {
  competitive: {
    ar: "تنافسي",
    en: "Competitive",
    id: "Kompetitif",
    forRoom: true,
  },
  cooperative: {
    ar: "تعاوني",
    en: "Cooperative",
    id: "Kooperatif",
    forRoom: true,
  },
  endless: {
    ar: "بلا نهاية",
    en: "Endless",
    id: "Tanpa Batas",
    forRoom: false,
  },
  practice: {
    ar: "تمرين",
    en: "Practice",
    id: "Latihan",
    forRoom: false,
  },
  learning: {
    ar: "تعليمي (قديم)",
    en: "Learning (old)",
    id: "Pembelajaran (lama)",
    forRoom: true,
  },
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
    const key = MODE_LABEL_KEY[mode] ?? MODE_LABEL_KEY.competitive;
    if (locale === "ar") return key.ar;
    if (locale === "en") return key.en;
    return key.id;
  };

  const isForRoom = (mode: string) =>
    (MODE_LABEL_KEY[mode] ?? MODE_LABEL_KEY.competitive).forRoom;

  const labels = {
    title: isRtl ? "الألعاب" : locale === "en" ? "Games" : "Permainan",
    subtitle: isRtl
      ? "أنشئ لعبة واستخدم أسئلتك الحالية في تجربة تعليمية تفاعلية."
      : locale === "en"
        ? "Create a game and use your existing questions in an interactive learning experience."
        : "Buat permainan dan gunakan soal yang sudah ada untuk pengalaman belajar interaktif.",
    back: isRtl ? "لوحة التحكم" : locale === "en" ? "Dashboard" : "Dashboard",
    my_games: isRtl
      ? "ألعابي"
      : locale === "en"
        ? "My Games"
        : "Permainan Saya",
    my_games_desc: isRtl
      ? "الألعاب التي أنشأها حسابك الحالي."
      : locale === "en"
        ? "Games created by your current account."
        : "Permainan yang dibuat oleh akun Anda.",
    no_games: isRtl
      ? "لا توجد ألعاب بعد."
      : locale === "en"
        ? "No games yet."
        : "Belum ada permainan.",
    play: isRtl
      ? "▶ تشغيل اللعبة"
      : locale === "en"
        ? "▶ Play Game"
        : "▶ Mainkan",
    no_room: isRtl
      ? "بدون غرفة"
      : locale === "en"
        ? "No room"
        : "Tanpa Room",
    self_practice: isRtl
      ? "📖 تدريب ذاتي — متاح في بوابة الطالب"
      : locale === "en"
        ? "📖 Self-practice — available in Student Portal"
        : "📖 Latihan mandiri — tersedia di Portal Siswa",
    create_title: isRtl
      ? "إنشاء لعبة جديدة"
      : locale === "en"
        ? "Create New Game"
        : "Buat Permainan Baru",
    create_desc: isRtl
      ? "اختر الفصل والأسئلة ثم اضبط طريقة اللعب."
      : locale === "en"
        ? "Choose class and questions, then set the game mode."
        : "Pilih kelas dan soal, lalu atur mode permainan.",
    label_name: isRtl
      ? "اسم اللعبة"
      : locale === "en"
        ? "Game Name"
        : "Nama Permainan",
    label_class: isRtl
      ? "الفصل الدراسي"
      : locale === "en"
        ? "Class"
        : "Kelas",
    choose_class: isRtl
      ? "اختر الفصل"
      : locale === "en"
        ? "Choose class"
        : "Pilih kelas",
    label_ranking: isRtl
      ? "إظهار الترتيب"
      : locale === "en"
        ? "Show ranking"
        : "Tampilkan peringkat",
    ranking_full: isRtl
      ? "للجميع"
      : locale === "en"
        ? "Everyone"
        : "Semua",
    ranking_hidden: isRtl
      ? "مخفي"
      : locale === "en"
        ? "Hidden"
        : "Disembunyikan",
    ranking_self: isRtl
      ? "لللاعب نفسه"
      : locale === "en"
        ? "Only player"
        : "Hanya pemain",
    btn_create: isRtl
      ? "إنشاء اللعبة"
      : locale === "en"
        ? "Create Game"
        : "Buat Permainan",
    no_class_warn: isRtl
      ? "أنشئ فصلًا دراسيًا أولًا قبل إنشاء اللعبة."
      : locale === "en"
        ? "Create a class first before creating a game."
        : "Buat kelas dulu sebelum membuat permainan.",
    no_bank_warn: isRtl
      ? "أنشئ بنك أسئلة أولًا قبل إنشاء اللعبة."
      : locale === "en"
        ? "Create a question bank first before creating a game."
        : "Buat bank soal dulu sebelum membuat permainan.",
    delete_title: isRtl
      ? "حذف اللعبة"
      : locale === "en"
        ? "Delete game"
        : "Hapus permainan",
  };

  return (
    <main className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-terracotta-500">
            {dict.common.brand_top}
          </p>
          <h1 className="font-display mt-1 text-3xl font-black tracking-tight text-teal-700">
            {labels.title}
          </h1>
          <p className="mt-2 text-sm text-softslate/80">{labels.subtitle}</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 transition hover:bg-sage-50"
        >
          {labels.back}
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
              {labels.my_games}
            </h2>
            <p className="mt-1 text-sm text-softslate/70">
              {labels.my_games_desc}
            </p>
          </div>
          <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-bold text-terracotta-600">
            {gameList.length}
          </span>
        </div>

        {gameList.length === 0 ? (
          <div className="aesthetic-card text-center text-sm text-softslate/70">
            {labels.no_games}
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
                        {durationMinutes} {isRtl ? "د" : "min"}
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
                      {labels.self_practice}
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
                          {labels.play}
                        </button>
                      </form>
                    ) : (
                      <div className="flex-1 rounded-full border border-dashed border-teal-200 bg-teal-50 px-4 py-2.5 text-center text-xs font-bold text-teal-700">
                        {labels.no_room}
                      </div>
                    )}

                    <form action={deleteGame}>
                      <input type="hidden" name="game_id" value={game.id} />
                      <button
                        type="submit"
                        title={labels.delete_title}
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
            {labels.create_title}
          </h2>
          <p className="mt-1 text-sm text-softslate/70">
            {labels.create_desc}
          </p>
        </div>

        {classList.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-terracotta-500/25 bg-terracotta-50 p-4 text-sm text-terracotta-600">
            {labels.no_class_warn}
          </div>
        ) : bankList.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-terracotta-500/25 bg-terracotta-50 p-4 text-sm text-terracotta-600">
            {labels.no_bank_warn}
          </div>
        ) : (
          <form action={createGame} className="mt-6 space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label
                  htmlFor="game-name"
                  className="block text-sm font-bold text-teal-700"
                >
                  {labels.label_name}
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
                  {labels.label_class}
                </label>
                <select
                  id="class-id"
                  name="class_id"
                  required
                  defaultValue=""
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="" disabled>
                    {labels.choose_class}
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
                  {labels.label_ranking}
                </label>
                <select
                  id="ranking-visibility"
                  name="ranking_visibility"
                  defaultValue="full"
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="full">{labels.ranking_full}</option>
                  <option value="hidden">{labels.ranking_hidden}</option>
                  <option value="self_only">{labels.ranking_self}</option>
                </select>
              </div>

              <GameModeSelector
                tracks={tracks.map((t) => ({ id: t.id, name: t.name }))}
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
            />

            <button
              type="submit"
              className="w-full rounded-full bg-terracotta-500 px-5 py-3 text-sm font-black text-white transition hover:bg-terracotta-600"
            >
              {labels.btn_create}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}