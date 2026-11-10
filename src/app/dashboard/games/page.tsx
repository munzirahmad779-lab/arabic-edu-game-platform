import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createGame } from "./actions";
import { GameCardActions } from "./game-card-actions";
import { GameFormShell } from "./game-form-shell";
import { GameModeSelector } from "./game-mode-selector";
import { QuestionsPicker } from "./questions-picker";
import { getGameErrorMessage } from "./error-messages";
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
  const user = await getCurrentUser();

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
    { data: activeRooms },
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
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("rooms")
      .select("game_id, code, state")
      .eq("teacher_id", user.id)
      .in("state", ["waiting", "running"])
      .order("created_at", { ascending: false }),
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

  // Kode room aktif per game (room terbaru yang waiting/running).
  // Dipakai tautan Stik HP supaya memakai kode room sebenarnya dari
  // tabel rooms, bukan potongan ID game.
  const roomCodeByGame = new Map<string, string>();
  for (const r of activeRooms ?? []) {
    if (r.game_id && r.code && !roomCodeByGame.has(r.game_id)) {
      roomCodeByGame.set(r.game_id, r.code);
    }
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
          <p className="font-bold">
            {getGameErrorMessage(searchParams.error, searchParams.msg)}
          </p>
          {searchParams.msg && searchParams.msg.includes(" ") ? (
            <div className="mt-1 text-xs opacity-80">{searchParams.msg}</div>
          ) : null}
        </div>
      ) : null}

      {/* BANNER PROYEKTOR & REMOTE HP SISWA */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black backdrop-blur-sm">
              <span>📽️</span>
              <span>KONSOL KELAS & REMOTE HP SISWA</span>
            </div>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Mode Proyektor & Remote HP Nirkabel Siswa
            </h2>
            <p className="mt-2 text-sm text-emerald-100 leading-relaxed">
              Tampilkan game di layar proyektor smartboard kelas! Siswa menjawab serentak menggunakan HP masing-masing sebagai <strong>Stik Kontroler (4 Tim / Stik PS3)</strong> lengkap dengan bonus kecepatan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <a
              href="/controller"
              target="_blank"
              rel="noreferrer"
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-950 shadow-lg hover:bg-emerald-50 transition"
            >
              <span>📱</span>
              <span>Buka Kontroler HP Siswa (/controller)</span>
            </a>
            {gameList.length > 0 ? (
              <a
                href={`/dashboard/games/${gameList[0].id}/projector`}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-950/70 border border-white/20 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-950/90 transition"
              >
                <span>📽️</span>
                <span>Buka Layar Proyektor ({gameList[0].name})</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>

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

              const isEmbedGame = /\[EMBED:(.*?)\]/.test(game.name);
              const themeMatch = game.name.match(/\[THEME:(.*?)\]/);
              const theme = themeMatch ? themeMatch[1] : null;
              const displayName = game.name.replace(/\[(THEME|EMBED):.*?\]/, "").trim();

              const THEME_LABELS: Record<string, string> = {
                airplane: "✈️ Pesawat Awan",
                whack: "🔨 Pukul Tikus",
                wheel: "🎡 Roda Putar",
                memory: "🃏 Memori 3D",
                balloon: "🎈 Pecahkan Balon",
              };

              return (
                <article key={game.id} className="aesthetic-card flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display truncate text-lg font-black text-teal-700">
                        {displayName}
                      </h3>
                      <p className="mt-1 truncate text-sm text-softslate/70">
                        {className}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {theme && THEME_LABELS[theme] ? (
                      <span className="rounded-full bg-sky-100 px-2 py-1 font-bold text-sky-700">
                        {THEME_LABELS[theme]}
                      </span>
                    ) : isEmbedGame ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-1 font-bold text-indigo-700">
                        🌐 Web Game Asli
                      </span>
                    ) : (
                      <span className="rounded-full bg-terracotta-100 px-2 py-1 font-bold text-terracotta-600">
                        {getModeLabel(game.mode)}
                      </span>
                    )}
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

                  {!isRoom && !isEmbedGame ? (
                    <p className="mt-2 rounded-xl bg-teal-50 px-2 py-1.5 text-[11px] font-bold text-teal-700">
                      {t.self_practice}
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-2 pt-2">
                    {isEmbedGame ? (
                      <Link
                        href={`/dashboard/games/${game.id}/projector`}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:from-indigo-700 hover:to-purple-700"
                      >
                        <span className="text-base">▶️</span>
                        <span>Mainkan Web Game (Layar Penuh / TV)</span>
                      </Link>
                    ) : (
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/games/${game.id}/projector`}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:from-emerald-700 hover:to-teal-700 hover:scale-101"
                        >
                          <span className="text-base">📽️</span>
                          <span>Mode Proyektor & Remote HP</span>
                        </Link>

                        {roomCodeByGame.get(game.id) ? (
                          <a
                            href={`/controller?room=${roomCodeByGame.get(game.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Buka Stik Remote HP Siswa (/controller)"
                            className="flex items-center justify-center gap-1 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-xs font-bold text-sky-800 hover:bg-sky-100 transition shadow-xs"
                          >
                            <span>🎮</span>
                            <span className="hidden sm:inline">Stik HP</span>
                          </a>
                        ) : (
                          <Link
                            href={`/dashboard/games/${game.id}/projector`}
                            title="Belum ada room aktif untuk game ini: buka layar proyektor untuk memulai room dan mendapatkan kode Stik HP"
                            className="flex items-center justify-center gap-1 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-xs font-bold text-sky-800 hover:bg-sky-100 transition shadow-xs"
                          >
                            <span>🎮</span>
                            <span className="hidden sm:inline">Stik HP</span>
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Secondary Actions: Room Online, Pratinjau, Ubah,
                        Kloning (state nonaktif), Hapus. Komponen bersama
                        GameCardActions; sebelumnya pratinjau di komponen
                        ini tidak terjangkau dari halaman mana pun. */}
                    <GameCardActions
                      gameId={game.id}
                      gameName={displayName}
                      gameModeAr={getModeLabel(game.mode)}
                      isRoomMode={isRoom}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="font-display text-lg font-black text-teal-700">
            Game Mandiri di Perangkat Guru
          </h2>
          <p className="mt-1 text-sm text-softslate/70">
            Game yang dimainkan langsung di satu perangkat guru (kelas
            interaktif/proyektor), tanpa room dan tanpa kode gabung.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/game/sigetteng-getteng"
            className="aesthetic-card flex flex-col transition hover:shadow-md"
          >
            <h3 className="font-display text-lg font-black text-teal-700">
              🪢 Sigetteng-Getteng
            </h3>
            <p className="mt-1 text-sm text-softslate/70">
              Tarik tambang pengetahuan: DUEL 1v1 atau SQUAD 2v2 bergantian
              menjawab di perangkat yang sama. Bahasa Arab, Matematika,
              Biologi, dan Fisika SMA.
            </p>
            <span className="mt-3 inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
              Hot-seat · 1 perangkat
            </span>
          </Link>
          <Link
            href="/game/basket"
            className="aesthetic-card flex flex-col transition hover:shadow-md"
          >
            <h3 className="font-display text-lg font-black text-teal-700">
              🏀 Mabbasket
            </h3>
            <p className="mt-1 text-sm text-softslate/70">
              Dua tim menjawab soal lalu melempar bola ke ring untuk mencetak
              poin. Bisa memakai soal dari Bank Soal LMS sebagai Mapel Guru.
            </p>
            <span className="mt-3 inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
              Hot-seat · 1 perangkat
            </span>
          </Link>
          <Link
            href="/game/banua-fruit-blast"
            className="aesthetic-card flex flex-col transition hover:shadow-md"
          >
            <h3 className="font-display text-lg font-black text-teal-700">
              🍉 Makketapel
            </h3>
            <p className="mt-1 text-sm text-softslate/70">
              Potong buah yang berisi jawaban benar di lajurmu: DUEL, TRIO,
              dan SQUAD 2-4 pemain. Bisa memakai soal dari Bank Soal LMS
              sebagai Mapel Guru.
            </p>
            <span className="mt-3 inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
              Hot-seat · 1 perangkat
            </span>
          </Link>
          <Link
            href="/game/space-war"
            className="aesthetic-card flex flex-col transition hover:shadow-md"
          >
            <h3 className="font-display text-lg font-black text-teal-700">
              🚀 Mattembak Angkasa
            </h3>
            <p className="mt-1 text-sm text-softslate/70">
              Tembak asteroid soal dengan jawaban ketik atau pilihan: SOLO,
              DUEL, TRIO, dan QUAD. Bisa memakai soal dari Bank Soal LMS
              sebagai Mapel Guru.
            </p>
            <span className="mt-3 inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
              Hot-seat · 1 perangkat
            </span>
          </Link>
          <Link
            href="/game/ketapel-buah"
            className="aesthetic-card flex flex-col transition hover:shadow-md"
          >
            <h3 className="font-display text-lg font-black text-teal-700">
              🥭 Ketapel Buah
            </h3>
            <p className="mt-1 text-sm text-softslate/70">
              Tembak buah berisi jawaban benar yang menggantung di pohon
              lajurmu: SOLO, DUEL, TRIO, dan QUAD. Hati-hati, ada buah
              penyamar. Bisa memakai soal dari Bank Soal LMS sebagai Mapel
              Guru.
            </p>
            <span className="mt-3 inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
              Hot-seat · 1 perangkat
            </span>
          </Link>
          <Link
            href="/game/ketapel-burung"
            className="aesthetic-card flex flex-col transition hover:shadow-md"
          >
            <h3 className="font-display text-lg font-black text-teal-700">
              🐦 Ketapel Burung
            </h3>
            <p className="mt-1 text-sm text-softslate/70">
              Tembak burung terbang yang membawa papan jawaban benar: SOLO,
              DUEL, TRIO, dan QUAD. Bisa memakai soal dari Bank Soal LMS
              sebagai Mapel Guru.
            </p>
            <span className="mt-3 inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
              Hot-seat · 1 perangkat
            </span>
          </Link>
          <Link
            href="/game/jejak-angka"
            className="aesthetic-card flex flex-col transition hover:shadow-md"
          >
            <h3 className="font-display text-lg font-black text-teal-700">
              👣 Mallaleng Angka
            </h3>
            <p className="mt-1 text-sm text-softslate/70">
              Ular tangga sembunyi: jawab soal untuk melempar dadu dan
              balapan ke kotak 100, tangga dan ularnya baru ketahuan saat
              terinjak. SOLO, DUEL, TRIO, dan QUAD. Bisa memakai soal dari
              Bank Soal LMS.
            </p>
            <span className="mt-3 inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
              Hot-seat · 1 perangkat
            </span>
          </Link>
          <Link
            href="/game/ludo-angka"
            className="aesthetic-card flex flex-col transition hover:shadow-md"
          >
            <h3 className="font-display text-lg font-black text-teal-700">
              🎲 Maccule Ludo
            </h3>
            <p className="mt-1 text-sm text-softslate/70">
              Ludo soal: jawab benar untuk melempar dadu, keluar kandang
              dengan angka 6, tangkap pion lawan, dan balapan ke FINISH.
              SOLO, DUEL, TRIO, dan QUAD. Bisa memakai soal dari Bank
              Soal LMS.
            </p>
            <span className="mt-3 inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
              Hot-seat · 1 perangkat
            </span>
          </Link>
        </div>
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
          <GameFormShell action={createGame} submitLabel={t.btn_create}>
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
                gt={dict.game_type}
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
          </GameFormShell>
        )}
      </section>
    </main>
  );
}
