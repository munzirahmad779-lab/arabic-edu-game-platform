import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { updateGame } from "../actions";
import { GameFormShell } from "../game-form-shell";
import { GameModeSelector } from "../game-mode-selector";
import { QuestionsPicker } from "../questions-picker";
import { getGameErrorMessage } from "../error-messages";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SearchParams = {
  error?: string;
  msg?: string;
};

/**
 * Halaman ubah permainan. Sebelumnya edit tidak ada sama sekali:
 * guru hanya bisa kloning atau hapus lalu buat ulang. Formulir ini
 * memakai komponen yang sama dengan formulir buat (GameModeSelector,
 * QuestionsPicker, GameFormShell) dan mengirim ke aksi updateGame
 * yang validasinya berbagi pengurai dengan createGame.
 */
export default async function EditGamePage({
  params,
  searchParams,
}: {
  params: { gameId: string };
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) return null;

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const t = dict.games_page;

  const { data: game } = await supabase
    .from("games")
    .select(
      "id, name, class_id, game_type, mode, duration_seconds, ranking_visibility, backsound_track_id",
    )
    .eq("id", params.gameId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!game) {
    redirect("/dashboard/games?error=game_not_found");
  }

  const [
    { data: classes },
    { data: banks },
    { data: audioTracks },
    { data: categories },
    { data: questions },
    { data: gameQuestions },
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
      .from("game_questions")
      .select("question_id, position")
      .eq("game_id", game.id)
      .order("position", { ascending: true }),
  ]);

  const tracks = audioTracks ?? [];
  const categoriesList = categories ?? [];
  const classList = classes ?? [];
  const bankList = banks ?? [];
  const initialSelectedIds = (gameQuestions ?? []).map((gq) => gq.question_id);

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

  // Nama tersimpan membawa token [THEME:<mesin>] atau [EMBED:<url>];
  // pisahkan supaya formulir menampilkan nama bersih dan mesin/URL
  // yang sedang aktif.
  const embedMatch = game.name.match(/\[EMBED:([^\]]+)\]/);
  const themeMatch = game.name.match(/\[THEME:([^\]]+)\]/);
  const displayName = game.name.replace(/\[(THEME|EMBED):[^\]]*\]/, "").trim();
  const initialEmbedUrl = embedMatch ? embedMatch[1] : "";
  const initialEngine = embedMatch
    ? "web-embed"
    : themeMatch
      ? themeMatch[1]
      : "kahoot";
  const initialDurationMinutes = Math.min(
    60,
    Math.max(1, Math.round(game.duration_seconds / 60)),
  );

  return (
    <main className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-terracotta-500">
            {dict.common.brand_top}
          </p>
          <h1 className="font-display mt-1 text-3xl font-black tracking-tight text-teal-700">
            ✏️ Ubah Permainan
          </h1>
          <p className="mt-2 text-sm text-softslate/80">
            Ubah nama, kelas, mode, mesin permainan, dan daftar soal.
            Room yang sedang berjalan tidak berubah; perubahan berlaku
            untuk permainan berikutnya.
          </p>
        </div>
        <Link
          href="/dashboard/games"
          className="rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 transition hover:bg-sage-50"
        >
          ← Daftar Permainan
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

      <section className="aesthetic-card">
        <GameFormShell
          action={updateGame}
          submitLabel="💾 Simpan Perubahan"
          initialSelectedCount={initialSelectedIds.length}
        >
          <input type="hidden" name="game_id" value={game.id} />

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
                defaultValue={displayName}
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
                defaultValue={game.class_id ?? ""}
                className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
              >
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
                defaultValue={game.ranking_visibility}
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
              initialEngine={initialEngine}
              initialMode={game.mode}
              initialEmbedUrl={initialEmbedUrl}
              initialDurationMinutes={initialDurationMinutes}
              initialBacksoundTrackId={game.backsound_track_id ?? ""}
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
            initialSelectedIds={initialSelectedIds}
          />
        </GameFormShell>
      </section>
    </main>
  );
}
