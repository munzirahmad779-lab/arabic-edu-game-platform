"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Confetti } from "@/components/confetti";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import { RunnerPlayer } from "@/components/game-players/runner-player";
import { SlicerPlayer } from "@/components/game-players/slicer-player";
import { MatchingPlayer } from "@/components/game-players/matching-player";
import { PenaltyPlayer } from "@/components/game-players/penalty-player";
import type { GameSessionContext, NormalizedGameType, RawQuestion } from "@/lib/game-engine/types";

export type ProjectorTeam = {
  id: string;
  name: string;
  color: string;
  score: number;
  correctCount: number;
};

const DEFAULT_TEAMS: ProjectorTeam[] = [
  { id: "team-1", name: "Tim Merah (الفريق الأحمر)", color: "from-rose-500 to-red-600", score: 0, correctCount: 0 },
  { id: "team-2", name: "Tim Biru (الفريق الأزرق)", color: "from-sky-500 to-blue-600", score: 0, correctCount: 0 },
  { id: "team-3", name: "Tim Hijau (الفريق الأخضر)", color: "from-emerald-500 to-teal-600", score: 0, correctCount: 0 },
  { id: "team-4", name: "Tim Kuning (الفريق الأصفر)", color: "from-amber-400 to-yellow-500", score: 0, correctCount: 0 },
];

export function ProjectorScreen({
  gameName,
  initialGameType,
  questions,
  classStudents = [],
  isRtl = false,
}: {
  gameId?: string;
  gameName: string;
  initialGameType: NormalizedGameType;
  questions: RawQuestion[];
  classStudents?: Array<{ id: string; name: string }>;
  isRtl?: boolean;
}) {
  const [selectedMechanic, setSelectedMechanic] = useState<NormalizedGameType | "slicer">(
    initialGameType === "anagram" ? "slicer" : initialGameType,
  );
  const [teamCount, setTeamCount] = useState<number>(2);
  const [teams, setTeams] = useState<ProjectorTeam[]>(DEFAULT_TEAMS.slice(0, 2));
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Setup teams based on student list or team count
  const handleSetTeamCount = (count: number) => {
    setTeamCount(count);
    setTeams(DEFAULT_TEAMS.slice(0, count).map((t) => ({ ...t, score: 0, correctCount: 0 })));
    setCurrentTurnIdx(0);
  };

  const handleUseClassStudents = () => {
    if (classStudents.length < 2) return;
    const colors = [
      "from-rose-500 to-red-600",
      "from-sky-500 to-blue-600",
      "from-emerald-500 to-teal-600",
      "from-amber-400 to-yellow-500",
      "from-purple-500 to-indigo-600",
      "from-pink-500 to-rose-600",
    ];
    const studentTeams: ProjectorTeam[] = classStudents.slice(0, 6).map((s, idx) => ({
      id: s.id,
      name: s.name,
      color: colors[idx % colors.length] ?? "from-violet-500 to-indigo-600",
      score: 0,
      correctCount: 0,
    }));
    setTeams(studentTeams);
    setTeamCount(studentTeams.length);
    setCurrentTurnIdx(0);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const activeQuestion = questions[currentQIndex];
  const activeTeam = teams[currentTurnIdx] ?? teams[0];

  const handleCommitAnswer = useCallback(
    (optionId: string | null, answerText: string | null) => {
      if (!activeQuestion || showAnswerFeedback) return;

      setSelectedOptionId(optionId);
      const correctOpt = activeQuestion.options.find(
        (o) => o.option_key === activeQuestion.correct_option_key,
      );

      let isCorrect = false;
      if (optionId && correctOpt) {
        isCorrect = optionId === correctOpt.id;
      } else if (answerText && correctOpt) {
        isCorrect =
          answerText.trim().toLowerCase() === correctOpt.option_text.trim().toLowerCase();
      }

      setLastAnswerCorrect(isCorrect);
      setShowAnswerFeedback(true);

      if (isCorrect) {
        playSfx("correct");
        setTeams((prev) =>
          prev.map((t, idx) =>
            idx === currentTurnIdx
              ? { ...t, score: t.score + 100, correctCount: t.correctCount + 1 }
              : t,
          ),
        );
      } else {
        playSfx("wrong");
      }
    },
    [activeQuestion, showAnswerFeedback, currentTurnIdx],
  );

  const handleNextQuestion = useCallback(() => {
    setSelectedOptionId(null);
    setShowAnswerFeedback(false);

    if (currentQIndex + 1 < questions.length) {
      setCurrentQIndex((q) => q + 1);
      setCurrentTurnIdx((t) => (t + 1) % teams.length);
    } else {
      setGameFinished(true);
      playSfx("boost");
    }
  }, [currentQIndex, questions.length, teams.length]);

  const handleRestart = () => {
    setTeams((prev) => prev.map((t) => ({ ...t, score: 0, correctCount: 0 })));
    setCurrentQIndex(0);
    setCurrentTurnIdx(0);
    setGameFinished(false);
    setShowAnswerFeedback(false);
    setSelectedOptionId(null);
  };

  // Keyboard shortcut listener for Quiz answers (1-4 or A-D, Space/Enter for next)
  useEffect(() => {
    if (!gameStarted || gameFinished) return;

    function onKeyDown(e: KeyboardEvent) {
      if (showAnswerFeedback) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNextQuestion();
        }
        return;
      }

      if (!activeQuestion) return;

      const key = e.key.toUpperCase();
      if (["1", "2", "3", "4"].includes(key)) {
        const idx = Number(key) - 1;
        const opt = activeQuestion.options[idx];
        if (opt) handleCommitAnswer(opt.id, null);
      } else if (["A", "B", "C", "D"].includes(key)) {
        const opt = activeQuestion.options.find((o) => o.option_key === key);
        if (opt) handleCommitAnswer(opt.id, null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    gameStarted,
    gameFinished,
    showAnswerFeedback,
    activeQuestion,
    handleCommitAnswer,
    handleNextQuestion,
  ]);

  const mockSessionContext: GameSessionContext = useMemo(
    () => ({
      roomId: "projector-local",
      roomCode: "HOTSEAT",
      gameName,
      gameType: selectedMechanic === "slicer" ? "anagram" : selectedMechanic,
      gameMode: "competitive",
      durationSeconds: 600,
      participantId: activeTeam?.id ?? "team-1",
      participantName: activeTeam?.name ?? "Tim",
      questionIndex: currentQIndex,
      questionCount: questions.length,
      isRtl: Boolean(isRtl),
    }),
    [gameName, selectedMechanic, activeTeam, currentQIndex, questions.length, isRtl],
  );

  // Winner podium calculation
  const rankedTeams = useMemo(() => {
    return [...teams].sort((a, b) => b.score - a.score);
  }, [teams]);

  if (!questions || questions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="max-w-md rounded-3xl bg-slate-900 p-8 text-center border border-white/10 shadow-2xl">
          <div className="text-5xl">⚠️</div>
          <h1 className="mt-4 text-2xl font-black">Game Belum Memiliki Soal</h1>
          <p className="mt-2 text-sm text-slate-400">
            Tambahkan soal terlebih dahulu melalui Question Bank atau Game Editor.
          </p>
          <Link
            href="/dashboard/games"
            className="mt-6 inline-block rounded-2xl bg-violet-600 px-6 py-3 font-bold text-white transition hover:bg-violet-700"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // 1. SETUP STAGE: Choose teams and game mechanic before launching
  if (!gameStarted) {
    return (
      <main
        className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 sm:p-8 text-white"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard/games"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"
            >
              ← Kembali
            </Link>
            <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300">
              📽️ Mode Proyektor / Hot Seat Kelas
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 p-8 border border-white/10 shadow-2xl backdrop-blur text-center">
            <div className="text-6xl">📽️</div>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{gameName}</h1>
            <p className="mt-2 text-slate-300">
              Tampilkan permainan di layar proyektor / smartboard kelas. Siswa atau tim maju bergantian tanpa perlu HP!
            </p>

            {/* Select Mechanic on Projector */}
            <div className="mt-8 text-start">
              <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                Pilih Tampilan / Mekanik Permainan di Layar:
              </label>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { id: "quiz", label: "Quiz Besar", icon: "📝" },
                  { id: "runner", label: "Canvas Runner", icon: "🏃‍♂️" },
                  { id: "slicer", label: "Fruit Ninja", icon: "🗡️" },
                  { id: "matching", label: "Matching Pasangan", icon: "🧩" },
                  { id: "penalty", label: "Penalty Kick", icon: "⚽" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMechanic(m.id as NormalizedGameType | "slicer")}
                    className={`flex flex-col items-center justify-center rounded-2xl p-4 font-black transition border-2 ${
                      selectedMechanic === m.id
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-lg shadow-emerald-500/20"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30"
                    }`}
                  >
                    <span className="text-3xl">{m.icon}</span>
                    <span className="mt-2 text-xs">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Select Team Setup */}
            <div className="mt-8 text-start">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Pengaturan Tim / Siswa yang Bermain:
                </label>
                {classStudents.length >= 2 && (
                  <button
                    type="button"
                    onClick={handleUseClassStudents}
                    className="text-xs font-bold text-violet-400 underline hover:text-violet-300"
                  >
                    Gunakan Siswa dari Kelas ({classStudents.length} murid)
                  </button>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                {[2, 3, 4].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleSetTeamCount(cnt)}
                    className={`flex-1 rounded-2xl py-3 text-sm font-black transition border-2 ${
                      teamCount === cnt
                        ? "border-violet-400 bg-violet-600 text-white shadow-lg"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {cnt} Tim
                  </button>
                ))}
              </div>

              {/* Team Preview Cards */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {teams.map((team, idx) => (
                  <div
                    key={team.id}
                    className={`rounded-2xl p-4 text-center bg-gradient-to-br ${team.color} text-white shadow-lg`}
                  >
                    <div className="text-xs font-bold uppercase opacity-80">Peserta #{idx + 1}</div>
                    <div className="mt-1 font-black truncate">{team.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Big Screen Button */}
            <button
              type="button"
              onClick={() => {
                setGameStarted(true);
                playSfx("click");
              }}
              className="mt-10 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-10 py-4 text-xl font-black text-white shadow-2xl transition hover:scale-105 active:scale-95"
            >
              <span>🚀 Mulai di Proyektor</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 2. FINISHED STAGE: Championship Podium on Big Screen
  if (gameFinished) {
    const winner = rankedTeams[0];
    return (
      <main
        className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 p-6 text-white text-center flex flex-col justify-center items-center relative overflow-hidden"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <Confetti active={true} particleCount={220} originY={0.9} />

        <div className="relative z-10 max-w-3xl w-full rounded-3xl bg-white/10 p-8 border border-white/20 shadow-2xl backdrop-blur">
          <div className="text-7xl animate-bounce">🏆</div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-black">Pertandingan Selesai!</h1>
          <p className="mt-2 text-emerald-300 font-bold text-lg">
            Selamat kepada juara kelas hari ini!
          </p>

          {/* Winner Banner */}
          {winner && (
            <div className={`mt-8 rounded-3xl p-6 bg-gradient-to-r ${winner.color} text-white shadow-2xl`}>
              <div className="text-xs uppercase font-black tracking-widest opacity-80">
                🥇 JUARA 1 KELAS
              </div>
              <div className="mt-2 text-3xl sm:text-4xl font-black">{winner.name}</div>
              <div className="mt-2 text-xl font-black">
                {winner.score} Poin • {winner.correctCount} / {questions.length} Jawaban Benar
              </div>
            </div>
          )}

          {/* Leaderboard Table of Teams */}
          <div className="mt-6 rounded-2xl bg-slate-900/80 p-4 border border-white/10 text-start">
            <h3 className="text-xs font-black uppercase text-slate-400 mb-2">Peringkat Akhir:</h3>
            <div className="space-y-2">
              {rankedTeams.map((team, idx) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 p-3 font-bold"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-sm font-black">
                      #{idx + 1}
                    </span>
                    <span>{team.name}</span>
                  </div>
                  <span className="font-mono text-lg font-black text-emerald-400">
                    {team.score} Poin
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <button
              type="button"
              onClick={handleRestart}
              className="rounded-2xl bg-white px-6 py-3 font-black text-slate-900 shadow-lg transition hover:bg-slate-100"
            >
              🔄 Main Lagi
            </button>
            <Link
              href="/dashboard/games"
              className="rounded-2xl bg-white/20 px-6 py-3 font-black text-white transition hover:bg-white/30"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. LIVE GAMEPLAY STAGE ON PROJECTOR
  return (
    <main
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-3 sm:p-6 text-white flex flex-col justify-between"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top Projector HUD Header */}
      <header className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-violet-600 px-3 py-1 text-xs font-black">
              SOAL {currentQIndex + 1} / {questions.length}
            </span>
            <h1 className="text-lg font-black truncate max-w-xs sm:max-w-md">{gameName}</h1>
          </div>

          {/* Active Turn Highlight Banner */}
          <div
            className={`rounded-2xl px-5 py-2 bg-gradient-to-r ${activeTeam?.color} text-white font-black text-sm sm:text-base shadow-lg animate-pulse`}
          >
            👉 GILIRAN: {activeTeam?.name}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
              title="Layar Penuh"
            >
              {isFullscreen ? "🗗 Keluar Fullscreen" : "⛶ Layar Penuh"}
            </button>
            <button
              type="button"
              onClick={() => setGameFinished(true)}
              className="rounded-xl bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/30"
            >
              Akhiri
            </button>
          </div>
        </div>

        {/* Live Scoreboard Ribbon */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10">
          {teams.map((t, idx) => (
            <div
              key={t.id}
              className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-black transition ${
                currentTurnIdx === idx
                  ? "bg-white/20 border-2 border-white/40 shadow-md"
                  : "bg-white/5 text-white/70"
              }`}
            >
              <span className="truncate">{t.name}</span>
              <span className="font-mono text-emerald-400">{t.score} pts</span>
            </div>
          ))}
        </div>
      </header>

      {/* Central Interactive Gameplay Arena */}
      <section className="my-4 flex-1 flex flex-col justify-center">
        {selectedMechanic === "runner" ? (
          <RunnerPlayer
            key={activeQuestion?.id}
            question={activeQuestion}
            session={mockSessionContext}
            onSubmitAnswer={async (payload) => {
              handleCommitAnswer(payload.selectedOptionId, payload.answerText);
              return { accepted: true, isCorrect: true, scoreAwarded: 100 };
            }}
            isRtl={Boolean(isRtl)}
          />
        ) : selectedMechanic === "slicer" ? (
          <SlicerPlayer
            key={activeQuestion?.id}
            question={activeQuestion}
            session={mockSessionContext}
            onSubmitAnswer={async (payload) => {
              handleCommitAnswer(payload.selectedOptionId, payload.answerText);
              return { accepted: true, isCorrect: true, scoreAwarded: 150 };
            }}
            isRtl={Boolean(isRtl)}
          />
        ) : selectedMechanic === "matching" ? (
          <MatchingPlayer
            key={activeQuestion?.id}
            question={activeQuestion}
            session={mockSessionContext}
            onSubmitAnswer={async (payload) => {
              handleCommitAnswer(payload.selectedOptionId, payload.answerText);
              return { accepted: true, isCorrect: true, scoreAwarded: 100 };
            }}
            isRtl={Boolean(isRtl)}
          />
        ) : selectedMechanic === "penalty" ? (
          <PenaltyPlayer
            key={activeQuestion?.id}
            question={activeQuestion}
            session={mockSessionContext}
            onSubmitAnswer={async (payload) => {
              handleCommitAnswer(payload.selectedOptionId, payload.answerText);
              return { accepted: true, isCorrect: true, scoreAwarded: 100 };
            }}
            isRtl={Boolean(isRtl)}
          />
        ) : (
          /* Big Projector Quiz Layout */
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            {/* Massive Arabic Question Display */}
            <div className="rounded-3xl bg-white/10 p-6 sm:p-10 text-center border border-white/20 shadow-2xl backdrop-blur">
              <span className="inline-block rounded-full bg-violet-500/20 px-4 py-1 text-xs font-bold text-violet-300">
                Pertanyaan #{currentQIndex + 1}
              </span>
              <h2 className="mt-4 text-3xl sm:text-5xl font-black leading-relaxed text-white">
                {activeQuestion?.question_text}
              </h2>
            </div>

            {/* Huge Option Cards with Keyboard Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeQuestion?.options.map((opt, idx) => {
                const isSelected = selectedOptionId === opt.id;
                const isCorrect = opt.option_key === activeQuestion.correct_option_key;

                let cardStyle = "border-white/10 bg-white/5 hover:bg-white/15 text-white";
                if (showAnswerFeedback) {
                  if (isCorrect) {
                    cardStyle = "border-emerald-400 bg-emerald-600/80 text-white shadow-emerald-500/50 shadow-xl";
                  } else if (isSelected) {
                    cardStyle = "border-rose-400 bg-rose-600/80 text-white shadow-rose-500/50 shadow-xl";
                  } else {
                    cardStyle = "border-white/5 bg-white/5 opacity-50";
                  }
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={showAnswerFeedback}
                    onClick={() => handleCommitAnswer(opt.id, null)}
                    className={`flex items-center gap-4 rounded-3xl p-5 text-start font-black text-xl transition-all border-2 active:scale-98 ${cardStyle}`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black">
                      {opt.option_key}
                    </span>
                    <span className="text-xl sm:text-2xl flex-1">{opt.option_text}</span>
                    <span className="text-xs uppercase opacity-40 font-mono">[{idx + 1}]</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Answer Feedback Banner & Next Question Trigger */}
      {showAnswerFeedback && (
        <footer className="rounded-2xl p-4 bg-slate-900/90 border border-white/20 backdrop-blur shadow-2xl flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{lastAnswerCorrect ? "🎉" : "💡"}</span>
            <div>
              <div className="text-lg font-black text-white">
                {lastAnswerCorrect ? "Jawaban Benar! (+100 Poin)" : "Jawaban Kurang Tepat!"}
              </div>
              <div className="text-xs text-slate-300">
                {activeQuestion?.explanation
                  ? `Penjelasan: ${activeQuestion.explanation}`
                  : `Jawaban tepat: ${
                      activeQuestion?.options.find(
                        (o) => o.option_key === activeQuestion.correct_option_key,
                      )?.option_text ?? ""
                    }`}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextQuestion}
            className="rounded-2xl bg-emerald-500 px-8 py-3 text-lg font-black text-white shadow-xl transition hover:bg-emerald-600 active:scale-95"
          >
            Lanjut Soal Berikutnya → [Spasi]
          </button>
        </footer>
      )}
    </main>
  );
}
