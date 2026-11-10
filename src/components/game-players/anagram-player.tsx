"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { pauseBackgroundAudio, resumeBackgroundAudio } from "@/lib/bg-audio-events";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import { normalizeAnswer, splitIntoGraphemes } from "@/lib/game-engine/arabic-utils";
import type { AnswerResult, GamePlayerProps, RawQuestion } from "@/lib/game-engine/types";

// ---------------------------------------------------------------------------
// AnagramPlayer: pemain room untuk tipe anagram (W4-M4 gelombang 3a).
//
// Soal anagram dinilai server lewat teks (answerText), bukan pilihan:
// route sesi memang tidak mengirim kunci jawaban ke klien, jadi vonis
// benar/salah di sini HANYA berasal dari AnswerResult.isCorrect hasil
// onSubmitAnswer. Komponen ini tidak membaca kunci soal apa pun dan
// tidak pernah menampilkan jawaban benar.
//
// String "wrong" dari kamus anagram sengaja TIDAK dibaca: string itu
// memuat penampung jawaban benar, sedangkan jawaban benar tidak
// tersedia di klien room. Umpan balik salah memakai kalimat netral
// yang sama dengan QuizPlayer ("Jawaban Kurang Tepat! ✗").
//
// Ambang ubin huruf: bank ubin hanya dibangun bila teks soal tampak
// seperti kata/frasa acak susunan guru, bukan kalimat soal panjang.
// Batas yang dipilih: 2 s.d. 24 grafem bukan-spasi, maksimal 4 kata,
// dan satu baris. Di luar ambang itu ubin disembunyikan dan siswa
// cukup mengetik jawabannya di kolom teks. Urutan ubin mengikuti
// urutan teks dari server apa adanya; pengacakan adalah pekerjaan
// guru saat menyusun soal, klien tidak mengacak ulang.
// ---------------------------------------------------------------------------

const TILE_MAX_GRAPHEMES = 24;
const TILE_MAX_WORDS = 4;

const ARABIC_FONT = "'Traditional Arabic', Amiri, Tahoma, serif";

function pickString(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

// Segmentasi grafem yang mempertahankan spasi (untuk menyelaraskan
// teks ketikan dengan bank ubin). splitIntoGraphemes di arabic-utils
// membuang spasi, jadi jalur ketik memakai segmentasi sendiri dengan
// cadangan Array.from, meniru pola util yang sama.
function segmentAllGraphemes(value: string): string[] {
  if (!value) return [];
  const normalized = value.normalize("NFC");
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("ar", { granularity: "grapheme" });
    return Array.from(segmenter.segment(normalized), (s) => s.segment);
  }
  return Array.from(normalized);
}

export function AnagramPlayer({
  question,
  onSubmitAnswer,
  isRtl,
  dict,
  onGameEvent,
}: GamePlayerProps<RawQuestion>) {
  // Kosakata dari kamus anagram (id/ar/en) dengan cadangan Bahasa
  // Indonesia persis isi id.json bila kamus tidak membawa kuncinya.
  const anagramDict = (dict?.anagram ?? undefined) as
    | Record<string, unknown>
    | undefined;
  const strings = {
    title: pickString(anagramDict, "title", "Susun Huruf"),
    instruction: pickString(
      anagramDict,
      "instruction",
      "Susun huruf menjadi jawaban yang benar",
    ),
    submit: pickString(anagramDict, "submit", "Periksa"),
    clear: pickString(anagramDict, "clear", "Hapus Semua"),
    backspace: pickString(anagramDict, "backspace", "Hapus 1"),
    correct: pickString(anagramDict, "correct", "✓ Benar!"),
    noLetters: pickString(anagramDict, "no_letters", "Pilih huruf dulu"),
    shuffledHint: pickString(anagramDict, "shuffled_hint", "Huruf sudah diacak"),
  };

  // Bank ubin: grafem bukan-spasi dari teks soal, urutan server.
  const tiles = useMemo(() => {
    const trimmed = question.question_text.trim();
    if (!trimmed || trimmed.includes("\n")) return [];
    const letters = splitIntoGraphemes(trimmed);
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (
      letters.length < 2 ||
      letters.length > TILE_MAX_GRAPHEMES ||
      wordCount > TILE_MAX_WORDS
    ) {
      return [];
    }
    return letters;
  }, [question.question_text]);
  const tilesActive = tiles.length > 0;
  const sourceHasSpace = /\s/.test(question.question_text.trim());

  // Jawaban disimpan sebagai daftar grafem; tileIdx sejajar berisi
  // indeks ubin asal tiap grafem (null bila grafem diketik langsung
  // atau berupa spasi), supaya tombol hapus dapat membebaskan ubin
  // yang tepat dan ubin terpakai dapat diturunkan dari state ini.
  const [chars, setChars] = useState<string[]>([]);
  const [tileIdx, setTileIdx] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    awarded: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Waktu soal ini mulai ditampilkan, untuk responseTimeMs yang nyata
  // (pola yang sama dengan QuizPlayer, cacat K28).
  const questionShownAtRef = useRef<number>(Date.now());

  useEffect(() => {
    setChars([]);
    setTileIdx([]);
    setSubmitting(false);
    setHasAnswered(false);
    setFeedback(null);
    setNotice(null);
    questionShownAtRef.current = Date.now();
  }, [question.id]);

  const usedTiles = useMemo(
    () => new Set(tileIdx.filter((i): i is number => i !== null)),
    [tileIdx],
  );
  const locked = submitting || hasAnswered;
  const answerText = chars.join("");

  function handleTileTap(index: number) {
    if (locked || usedTiles.has(index)) return;
    playSfx("click");
    setNotice(null);
    setChars((prev) => [...prev, tiles[index]]);
    setTileIdx((prev) => [...prev, index]);
  }

  function handleSpaceTap() {
    if (locked) return;
    if (chars.length === 0 || chars[chars.length - 1] === " ") return;
    playSfx("click");
    setNotice(null);
    setChars((prev) => [...prev, " "]);
    setTileIdx((prev) => [...prev, null]);
  }

  function handleBackspace() {
    if (locked || chars.length === 0) return;
    playSfx("click");
    setNotice(null);
    setChars((prev) => prev.slice(0, -1));
    setTileIdx((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    if (locked || chars.length === 0) return;
    playSfx("click");
    setNotice(null);
    setChars([]);
    setTileIdx([]);
  }

  // Ketikan langsung diselaraskan ke bank ubin secara rakus: tiap
  // grafem ketikan memakan satu ubin bebas yang sama persis bila ada;
  // grafem tanpa ubin pasangannya tetap diterima sebagai ketikan
  // bebas (indeks null), dan spasi tidak pernah memakan ubin.
  function handleInputChange(value: string) {
    if (locked) return;
    setNotice(null);
    const nextChars = segmentAllGraphemes(value);
    const used = new Set<number>();
    const nextIdx = nextChars.map((ch) => {
      if (ch.trim() === "") return null;
      const found = tiles.findIndex((tile, i) => !used.has(i) && tile === ch);
      if (found === -1) return null;
      used.add(found);
      return found;
    });
    setChars(nextChars);
    setTileIdx(nextIdx);
  }

  async function handleSubmit() {
    if (locked) return;
    const cleaned = normalizeAnswer(answerText);
    if (!cleaned) {
      // Belum ada huruf yang dipilih/diketik: beri tahu siswa tanpa
      // mengirim apa pun ke server (string kamus "no_letters").
      setNotice(strings.noLetters);
      return;
    }
    setNotice(null);
    setSubmitting(true);
    playSfx("click");

    // Kunci hasAnswered hanya dipasang SESUDAH server menerima
    // jawaban. Bila pengiriman ditolak (promise melempar) atau hasil
    // accepted: false, kunci dibebaskan dan jawaban yang sudah
    // disusun dipertahankan supaya siswa dapat mengirim ulang
    // (pola K28 di QuizPlayer).
    const responseTimeMs = Math.max(0, Date.now() - questionShownAtRef.current);

    let result: AnswerResult;
    try {
      result = await onSubmitAnswer({
        questionId: question.id,
        selectedOptionId: null,
        answerText: cleaned,
        responseTimeMs,
      });
    } catch {
      setSubmitting(false);
      return;
    }

    if (!result.accepted) {
      setSubmitting(false);
      return;
    }

    setHasAnswered(true);

    // Skor umpan balik memakai nilai nyata dari hasil server.
    // Cadangannya mengikuti aturan platform di room-store (benar 100,
    // salah 0), bukan angka karangan di sini.
    const awarded = result.scoreAwarded ?? (result.isCorrect ? 100 : 0);
    setFeedback({ isCorrect: result.isCorrect, awarded });

    if (result.isCorrect) {
      playSfx("correct");
      onGameEvent?.({
        isCorrect: true,
        scoreAwarded: awarded,
        comboMultiplier: 1,
        streak: 1,
        consequence: "neutral",
        message: strings.correct,
      });
    } else {
      playSfx("wrong");
      onGameEvent?.({
        isCorrect: false,
        scoreAwarded: awarded,
        comboMultiplier: 1,
        streak: 0,
        consequence: "neutral",
        message: "Jawaban Kurang Tepat! ✗",
      });
    }

    setSubmitting(false);
  }

  return (
    <section
      className="space-y-6 rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl sm:p-8"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Media Attachments (pola yang sama dengan QuizPlayer) */}
      {question.media && question.media.length > 0 && (
        <div className="space-y-4">
          {question.media.map((m) => {
            if (!m.public_url) return null;
            if (m.media_type === "image") {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={m.id}
                  src={m.public_url}
                  alt=""
                  className="mx-auto max-h-80 rounded-2xl border-2 border-slate-200 object-contain shadow-sm"
                />
              );
            }
            if (m.media_type === "audio") {
              return (
                <div key={m.id} className="space-y-2 text-center">
                  <p className="text-xs font-bold text-teal-600">Dengarkan audio</p>
                  <audio
                    src={m.public_url}
                    controls
                    onPlay={() => pauseBackgroundAudio()}
                    onPause={() => resumeBackgroundAudio()}
                    onEnded={() => resumeBackgroundAudio()}
                    className="mx-auto w-full max-w-md"
                  />
                </div>
              );
            }
            if (m.media_type === "video") {
              return (
                <div key={m.id} className="space-y-2 text-center">
                  <p className="text-xs font-bold text-teal-600">Tonton video</p>
                  <video
                    src={m.public_url}
                    controls
                    onPlay={() => pauseBackgroundAudio()}
                    onPause={() => resumeBackgroundAudio()}
                    onEnded={() => resumeBackgroundAudio()}
                    className="mx-auto max-h-80 w-full rounded-2xl border-2 border-slate-200"
                  />
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Judul mode + prompt soal */}
      <div className="space-y-3 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-3 py-1 text-xs font-black text-white shadow">
          🔤 {strings.title}
        </span>
        <h2
          className="text-center text-2xl sm:text-3xl md:text-4xl font-black leading-relaxed text-slate-900 break-words"
          style={{ fontFamily: ARABIC_FONT }}
          dir="auto"
        >
          {question.question_text}
        </h2>
        <p className="text-sm font-bold text-slate-500">{strings.instruction}</p>
        {tilesActive ? (
          <p className="text-xs font-bold text-slate-400">{strings.shuffledHint}</p>
        ) : null}
      </div>

      {/* Kolom jawaban: dapat diketuk dari ubin maupun diketik langsung */}
      <div className="space-y-2">
        <input
          type="text"
          value={answerText}
          onChange={(e) => handleInputChange(e.target.value)}
          disabled={locked}
          dir="auto"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={strings.instruction}
          className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-center text-2xl font-black tracking-wide text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          style={{ fontFamily: ARABIC_FONT }}
        />
        {notice ? (
          <p role="alert" className="text-center text-sm font-bold text-amber-600">
            {notice}
          </p>
        ) : null}
      </div>

      {/* Bank ubin huruf */}
      {tilesActive ? (
        <div className="flex flex-wrap items-center justify-center gap-2" dir="auto">
          {tiles.map((tile, index) => {
            const used = usedTiles.has(index);
            return (
              <button
                key={index}
                type="button"
                disabled={locked || used}
                onClick={() => handleTileTap(index)}
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 text-xl font-black shadow-sm transition active:scale-95 disabled:cursor-not-allowed ${
                  used
                    ? "border-slate-100 bg-slate-100 text-slate-300 opacity-50"
                    : "border-teal-600 bg-teal-50 text-slate-900 hover:bg-teal-100"
                }`}
                style={{ fontFamily: ARABIC_FONT }}
              >
                {tile}
              </button>
            );
          })}
          {sourceHasSpace ? (
            <button
              type="button"
              disabled={locked}
              onClick={handleSpaceTap}
              aria-label="Spasi"
              className="inline-flex h-12 w-16 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-lg font-black text-slate-500 shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 hover:border-teal-500"
            >
              ␣
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Kontrol susunan */}
      {chars.length > 0 && !hasAnswered ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={locked}
            onClick={handleBackspace}
            className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 hover:border-terracotta-500"
          >
            ⌫ {strings.backspace}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={handleClear}
            className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 hover:border-terracotta-500"
          >
            🧹 {strings.clear}
          </button>
        </div>
      ) : null}

      {/* Umpan balik dari vonis server */}
      {feedback ? (
        <div
          role="status"
          className={`rounded-2xl border-2 p-4 text-center text-lg font-black ${
            feedback.isCorrect
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.isCorrect ? strings.correct : "Jawaban Kurang Tepat! ✗"}
          {feedback.awarded > 0 ? (
            <span className="mt-1 block text-base">+{feedback.awarded}</span>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          className="w-full rounded-2xl bg-terracotta-500 px-6 py-4 text-lg font-black text-white shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-terracotta-600"
        >
          {submitting ? "…" : `✓ ${strings.submit}`}
        </button>
      )}
    </section>
  );
}
