"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Confetti } from "@/components/confetti";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import { RunnerPlayer } from "@/components/game-players/runner-player";
import { SlicerPlayer } from "@/components/game-players/slicer-player";
import { MatchingPlayer } from "@/components/game-players/matching-player";
import { PenaltyPlayer } from "@/components/game-players/penalty-player";
import type { GameSessionContext, NormalizedGameType, RawQuestion } from "@/lib/game-engine/types";

export type StudentMember = {
  id: string;
  name: string;
  class_id: string;
  class_name?: string;
};

export type TeacherClass = {
  id: string;
  name: string;
  subject?: string | null;
};

export type ProjectorTeam = {
  id: string;
  name: string;
  color: string;
  badgeBg: string;
  accentBorder: string;
  textColor: string;
  score: number;
  correctCount: number;
  members: StudentMember[];
  currentMemberIndex: number;
};

const INITIAL_TEAMS_CONFIG: Array<Omit<ProjectorTeam, "members" | "currentMemberIndex" | "score" | "correctCount">> = [
  {
    id: "team-1",
    name: "Tim Merah (الفريق الأحمر)",
    color: "from-rose-600 to-red-700",
    badgeBg: "bg-rose-500",
    accentBorder: "border-rose-400",
    textColor: "text-rose-400",
  },
  {
    id: "team-2",
    name: "Tim Biru (الفريق الأزرق)",
    color: "from-sky-600 to-blue-700",
    badgeBg: "bg-sky-500",
    accentBorder: "border-sky-400",
    textColor: "text-sky-400",
  },
  {
    id: "team-3",
    name: "Tim Hijau (الفريق الأخضر)",
    color: "from-emerald-600 to-teal-700",
    badgeBg: "bg-emerald-500",
    accentBorder: "border-emerald-400",
    textColor: "text-emerald-400",
  },
  {
    id: "team-4",
    name: "Tim Kuning (الفريق الأصفر)",
    color: "from-amber-500 to-yellow-600",
    badgeBg: "bg-amber-500",
    accentBorder: "border-amber-400",
    textColor: "text-amber-400",
  },
];

export function ProjectorScreen({
  gameId,
  gameName,
  initialGameType,
  questions,
  allStudents = [],
  teacherClasses = [],
  defaultClassId = "",
  isRtl = false,
}: {
  gameId?: string;
  gameName: string;
  initialGameType: NormalizedGameType;
  questions: RawQuestion[];
  allStudents?: StudentMember[];
  teacherClasses?: TeacherClass[];
  defaultClassId?: string;
  isRtl?: boolean;
}) {
  const [selectedMechanic, setSelectedMechanic] = useState<NormalizedGameType | "slicer">(
    initialGameType === "anagram" ? "slicer" : initialGameType,
  );

  // Layout mode: "focus" (1 full arena with turn switcher) or "split" (4 quadrants arena)
  const [layoutMode, setLayoutMode] = useState<"focus" | "split">("split");

  // Selected class filter for assigning students
  const [selectedClassId, setSelectedClassId] = useState<string>(
    defaultClassId || teacherClasses[0]?.id || "",
  );

  // Teams state
  const [teamCount, setTeamCount] = useState<number>(4);
  const [teams, setTeams] = useState<ProjectorTeam[]>(() => {
    return INITIAL_TEAMS_CONFIG.slice(0, 4).map((cfg) => ({
      ...cfg,
      score: 0,
      correctCount: 0,
      members: [],
      currentMemberIndex: 0,
    }));
  });

  // Current turn indices
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [currentRoundOffset, setCurrentRoundOffset] = useState(0);

  // Speed Bonus tracking: List of teams that answered correctly in the current round, in order of arrival
  const [correctAnswersOrder, setCorrectAnswersOrder] = useState<string[]>([]);

  // Track which teams have answered the CURRENT question
  // Record<teamId, { isCorrect: boolean; score: number; speedBonus: number; bonusTitle: string; optionKey: string }>
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<
      string,
      {
        isCorrect: boolean;
        score: number;
        speedBonus: number;
        bonusTitle: string;
        optionKey: string;
      }
    >
  >({});

  // Single focus turn UI states
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);

  // Game lifecycle
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTeamStudioModal, setShowTeamStudioModal] = useState(false);
  const [showRemoteInfoModal, setShowRemoteInfoModal] = useState(false);
  const [newStudentNameInput, setNewStudentNameInput] = useState("");
  const [targetTeamForNewStudent, setTargetTeamForNewStudent] = useState("team-1");

  // Wireless Phone Controller sync state
  const roomCode = useMemo(() => {
    return gameId ? gameId.slice(0, 6).toUpperCase() : "HOTSEAT";
  }, [gameId]);

  const [activeControllers, setActiveControllers] = useState<string[]>([]);
  const lastEventTimestampRef = useRef<number>(Date.now());

  // Filter students based on selected class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return allStudents;
    return allStudents.filter((s) => s.class_id === selectedClassId);
  }, [allStudents, selectedClassId]);

  // Minimum 4 questions rule check
  const hasMinimumQuestions = questions.length >= 4;

  // Auto-distribute / shuffle students evenly across active teams
  const handleAutoDistributeStudents = useCallback(() => {
    const pool = [...classStudents].sort(() => Math.random() - 0.5);
    const newTeams = teams.map((t) => ({ ...t, members: [] as StudentMember[], currentMemberIndex: 0 }));

    pool.forEach((student, idx) => {
      const targetTeam = newTeams[idx % newTeams.length];
      if (targetTeam) {
        targetTeam.members.push(student);
      }
    });

    setTeams(newTeams);
    playSfx("correct");
  }, [classStudents, teams]);

  // On first load, automatically distribute students if available
  useEffect(() => {
    if (classStudents.length > 0 && teams.every((t) => t.members.length === 0)) {
      const pool = [...classStudents];
      setTeams((prev) => {
        const next = prev.map((t) => ({ ...t, members: [] as StudentMember[] }));
        pool.forEach((s, idx) => {
          const t = next[idx % next.length];
          if (t) t.members.push(s);
        });
        return next;
      });
    }
  }, [classStudents]);

  // Adjust team count (1 to 4)
  const handleSetTeamCount = (count: number) => {
    setTeamCount(count);
    const sliced = INITIAL_TEAMS_CONFIG.slice(0, count).map((cfg, idx) => {
      const existing = teams[idx];
      return {
        ...cfg,
        score: existing?.score ?? 0,
        correctCount: existing?.correctCount ?? 0,
        members: existing?.members ?? [],
        currentMemberIndex: existing?.currentMemberIndex ?? 0,
      };
    });
    setTeams(sliced);
    if (currentTurnIdx >= count) {
      setCurrentTurnIdx(0);
    }
  };

  // Add custom student name to team
  const handleAddManualStudent = () => {
    const trimmed = newStudentNameInput.trim();
    if (!trimmed) return;
    const newStudent: StudentMember = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      class_id: selectedClassId || "manual",
      class_name: "Kustom",
    };

    setTeams((prev) =>
      prev.map((t) =>
        t.id === targetTeamForNewStudent
          ? { ...t, members: [...t.members, newStudent] }
          : t,
      ),
    );
    setNewStudentNameInput("");
  };

  // Remove student from team
  const handleRemoveStudent = (studentId: string) => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        members: t.members.filter((m) => m.id !== studentId),
      })),
    );
  };

  // Set active player within a team
  const handleSetActiveMember = (teamId: string, memberIdx: number) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId ? { ...t, currentMemberIndex: memberIdx } : t,
      ),
    );
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

  // Resolve question for a specific team: Each team gets a DIFFERENT question!
  const getQuestionForTeam = useCallback(
    (teamIdx: number): RawQuestion => {
      if (questions.length === 0) return { id: "empty", position: 0, question_text: "", difficulty: "easy", correct_option_key: "A", explanation: "", options: [] };
      const index = (currentRoundOffset * teams.length + teamIdx) % questions.length;
      return questions[index] ?? questions[0]!;
    },
    [currentRoundOffset, teams.length, questions],
  );

  const activeQuestion = getQuestionForTeam(currentTurnIdx);
  const activeTeam = teams[currentTurnIdx] ?? teams[0];
  const activeStudentName =
    activeTeam?.members[activeTeam.currentMemberIndex % (activeTeam.members.length || 1)]
      ?.name || "Pemain Tim";

  // Check how many teams have answered current question round
  const answeredTeamCount = useMemo(() => {
    return Object.keys(questionAnswers).length;
  }, [questionAnswers]);

  const allTeamsAnsweredCurrentQ = answeredTeamCount >= teams.length;

  // Handle answering for a specific team (with SPEED BONUS and DIFFERENT questions!)
  const handleAnswerForTeam = useCallback(
    (teamId: string, optionId: string | null, optionKeyInput: string | null) => {
      const teamIdx = teams.findIndex((t) => t.id === teamId);
      if (teamIdx === -1) return;

      const teamQ = getQuestionForTeam(teamIdx);
      if (!teamQ) return;
      if (questionAnswers[teamId]) return; // already answered this round

      let isCorrect = false;
      let chosenKey = "";

      if (optionId) {
        const picked = teamQ.options.find((o) => o.id === optionId);
        chosenKey = picked?.option_key ?? "";
        isCorrect = picked?.option_key === teamQ.correct_option_key;
      } else if (optionKeyInput) {
        const keyUpper = optionKeyInput.toUpperCase().trim();
        const picked = teamQ.options.find((o) => o.option_key === keyUpper);
        chosenKey = keyUpper;
        isCorrect = keyUpper === teamQ.correct_option_key;
      }

      // SPEED BONUS CALCULATION:
      // First team to get it correct gets +50 speed bonus!
      // Second gets +25 speed bonus!
      let speedBonus = 0;
      let bonusTitle = isCorrect ? "✅ Tepat (+100 Pts)" : "❌ Kurang Tepat (0 Pts)";

      if (isCorrect) {
        const orderRank = correctAnswersOrder.length + 1;
        if (orderRank === 1) {
          speedBonus = 50;
          bonusTitle = "⚡ TERCEPAT #1! (+50 Bonus)";
        } else if (orderRank === 2) {
          speedBonus = 25;
          bonusTitle = "⚡ TERCEPAT #2! (+25 Bonus)";
        }
        setCorrectAnswersOrder((prev) => [...prev, teamId]);
      }

      const totalScore = isCorrect ? 100 + speedBonus : 0;

      // Update questionAnswers registry
      setQuestionAnswers((prev) => ({
        ...prev,
        [teamId]: { isCorrect, score: totalScore, speedBonus, bonusTitle, optionKey: chosenKey },
      }));

      // Update team score & rotate student inside the team
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id === teamId) {
            return {
              ...t,
              score: t.score + totalScore,
              correctCount: t.correctCount + (isCorrect ? 1 : 0),
              currentMemberIndex: t.currentMemberIndex + 1, // Auto-rotate student!
            };
          }
          return t;
        }),
      );

      if (isCorrect) {
        if (speedBonus > 0) {
          playSfx("boost");
        } else {
          playSfx("correct");
        }
      } else {
        playSfx("wrong");
      }

      // If in focus mode and current active team answered:
      if (teamId === activeTeam.id) {
        setSelectedOptionId(optionId);
        setLastAnswerCorrect(isCorrect);
        setShowAnswerFeedback(true);
      }
    },
    [teams, getQuestionForTeam, questionAnswers, correctAnswersOrder, activeTeam.id],
  );

  // Wireless Phone Controller Poller (Acts like PS3 wireless console controllers)
  useEffect(() => {
    if (!gameStarted || gameFinished) return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/projector/controller?roomCode=${roomCode}&since=${lastEventTimestampRef.current}`,
        );
        if (!res.ok) return;

        const data = await res.json();
        if (Array.isArray(data.activeControllers)) {
          setActiveControllers(data.activeControllers);
        }

        if (Array.isArray(data.events) && data.events.length > 0) {
          for (const ev of data.events) {
            if (ev.timestamp > lastEventTimestampRef.current) {
              lastEventTimestampRef.current = ev.timestamp;
            }
            if (ev.action === "press" && ev.teamId && ev.optionKey) {
              handleAnswerForTeam(ev.teamId, null, ev.optionKey);
            }
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 300);

    return () => window.clearInterval(interval);
  }, [gameStarted, gameFinished, roomCode, handleAnswerForTeam]);

  // Advance to next team's turn on turn mode
  const handleNextTeamTurn = useCallback(() => {
    setSelectedOptionId(null);
    setShowAnswerFeedback(false);

    const nextIdx = teams.findIndex(
      (t, i) => i > currentTurnIdx && !questionAnswers[t.id],
    );

    if (nextIdx !== -1) {
      setCurrentTurnIdx(nextIdx);
    } else {
      const firstUnanswered = teams.findIndex((t) => !questionAnswers[t.id]);
      if (firstUnanswered !== -1) {
        setCurrentTurnIdx(firstUnanswered);
      } else {
        handleNextQuestion();
      }
    }
  }, [currentTurnIdx, teams, questionAnswers]);

  // Advance to next question round (resets questionAnswers, speed bonus, and shifts round offset)
  const handleNextQuestion = useCallback(() => {
    setSelectedOptionId(null);
    setShowAnswerFeedback(false);
    setQuestionAnswers({});
    setCorrectAnswersOrder([]);

    const totalRounds = Math.ceil(questions.length / teams.length);
    if (currentRoundOffset + 1 < totalRounds) {
      setCurrentRoundOffset((r) => r + 1);
      setCurrentTurnIdx(0);
      playSfx("click");
    } else {
      setGameFinished(true);
      playSfx("boost");
    }
  }, [currentRoundOffset, questions.length, teams.length]);

  const handleRestart = () => {
    setTeams((prev) =>
      prev.map((t) => ({ ...t, score: 0, correctCount: 0, currentMemberIndex: 0 })),
    );
    setCurrentRoundOffset(0);
    setCurrentTurnIdx(0);
    setQuestionAnswers({});
    setCorrectAnswersOrder([]);
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
          if (allTeamsAnsweredCurrentQ) {
            handleNextQuestion();
          } else {
            handleNextTeamTurn();
          }
        }
        return;
      }

      const currentQ = getQuestionForTeam(currentTurnIdx);
      if (!currentQ) return;

      const key = e.key.toUpperCase();
      if (["1", "2", "3", "4"].includes(key)) {
        const idx = Number(key) - 1;
        const opt = currentQ.options[idx];
        if (opt) handleAnswerForTeam(activeTeam.id, opt.id, opt.option_key);
      } else if (["A", "B", "C", "D"].includes(key)) {
        const opt = currentQ.options.find((o) => o.option_key === key);
        if (opt) handleAnswerForTeam(activeTeam.id, opt.id, key);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    gameStarted,
    gameFinished,
    showAnswerFeedback,
    allTeamsAnsweredCurrentQ,
    currentTurnIdx,
    activeTeam.id,
    getQuestionForTeam,
    handleAnswerForTeam,
    handleNextQuestion,
    handleNextTeamTurn,
  ]);

  const mockSessionContext: GameSessionContext = useMemo(
    () => ({
      roomId: "projector-local",
      roomCode,
      gameName,
      gameType: selectedMechanic === "slicer" ? "anagram" : selectedMechanic,
      gameMode: "competitive",
      durationSeconds: 600,
      participantId: activeTeam?.id ?? "team-1",
      participantName: `${activeTeam?.name} - ${activeStudentName}`,
      questionIndex: currentRoundOffset,
      questionCount: questions.length,
      isRtl: Boolean(isRtl),
    }),
    [gameName, selectedMechanic, activeTeam, activeStudentName, currentRoundOffset, questions.length, isRtl, roomCode],
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

  // 1. SETUP STAGE: Choose teams, manage student roster, select game mechanic
  if (!gameStarted) {
    return (
      <main
        className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 sm:p-8 text-white"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard/games"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"
            >
              ← Kembali ke Dashboard
            </Link>
            <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300">
              📽️ Mode Proyektor & Console Smartboard
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 p-6 sm:p-8 border border-white/10 shadow-2xl backdrop-blur text-center">
            <div className="text-6xl">📽️</div>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{gameName}</h1>
            <p className="mt-2 text-slate-300 max-w-2xl mx-auto">
              Layar proyektor berfungsi layaknya konsol game TV! Siswa dapat bermain langsung di smartboard atau menggunakan HP sebagai remote nirkabel (4 Stik Controller).
            </p>

            {/* MINIMUM 4 QUESTIONS RULE VALIDATION BANNER */}
            {!hasMinimumQuestions ? (
              <div className="mt-6 rounded-2xl bg-amber-500/20 border-2 border-amber-400/80 p-4 text-start text-amber-200">
                <div className="flex items-center gap-2 font-black text-sm">
                  <span>⚠️ ATURAN GURU: SOAL KURANG DARI 4 BUTIR</span>
                </div>
                <p className="text-xs mt-1 text-amber-100">
                  Mode 4 Tim / Kuadran mewajibkan <strong>minimal 4 soal</strong> agar setiap kelompok mendapatkan soal yang berbeda. Saat ini permainan hanya memiliki <strong>{questions.length} soal</strong>. Silakan tambahkan soal di editor sebelum memulai 4 tim.
                </p>
              </div>
            ) : null}

            {/* Select Game Mechanic */}
            <div className="mt-8 text-start">
              <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                1. Pilih Tampilan / Mekanik Permainan:
              </label>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { id: "quiz", label: "Quiz Besar", icon: "📝" },
                  { id: "runner", label: "Canvas Runner", icon: "🏃‍♂️" },
                  { id: "slicer", label: "Fruit Slicer (Ninja)", icon: "🍉" },
                  { id: "matching", label: "Matching Kartu", icon: "🧩" },
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

            {/* Layout Mode Selection */}
            <div className="mt-8 text-start">
              <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                2. Mode Tampilan Layar Proyektor:
              </label>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLayoutMode("focus")}
                  className={`p-4 rounded-2xl border-2 text-start transition flex items-start gap-4 ${
                    layoutMode === "focus"
                      ? "border-violet-400 bg-violet-600/30 text-white shadow-lg"
                      : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <span className="text-3xl">📺</span>
                  <div>
                    <div className="font-black text-sm">Mode Giliran Penuh (Fokus 1 Tim Bergantian)</div>
                    <div className="text-xs text-slate-300 mt-1">
                      Layar menampilkan arena game penuh. Semua tim maju bergantian dengan soal unik masing-masing.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayoutMode("split")}
                  className={`p-4 rounded-2xl border-2 text-start transition flex items-start gap-4 ${
                    layoutMode === "split"
                      ? "border-emerald-400 bg-emerald-600/30 text-white shadow-lg"
                      : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <span className="text-3xl">⊞</span>
                  <div>
                    <div className="font-black text-sm">Mode Layar Terbagi 4 Kuadran (Multi-Arena)</div>
                    <div className="text-xs text-slate-300 mt-1">
                      Layar terbagi 4 kuadran dengan <strong>soal berbeda untuk masing-masing tim</strong>. Tim tercepat mendapat ⚡ Bonus Kecepatan!
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Team Roster & Studio */}
            <div className="mt-8 text-start rounded-3xl bg-slate-900/60 p-6 border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>👥 Pengaturan Tim & Siswa Kelas</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tentukan jumlah kelompok, pilih kelas (misal Kelas Mangkoso), dan bagi rata siswa secara otomatis.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {teacherClasses.length > 0 && (
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="rounded-xl bg-slate-800 border border-white/20 px-3 py-2 text-xs font-bold text-white focus:outline-hidden"
                    >
                      {teacherClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({allStudents.filter((s) => s.class_id === c.id).length} siswa)
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={handleAutoDistributeStudents}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-black text-white shadow hover:scale-105 transition"
                  >
                    🎲 Bagi Rata Otomatis
                  </button>
                </div>
              </div>

              {/* Number of Teams Selector */}
              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400">Jumlah Tim:</span>
                <div className="flex gap-2">
                  {[2, 3, 4].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleSetTeamCount(cnt)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black transition border ${
                        teamCount === cnt
                          ? "border-emerald-400 bg-emerald-500 text-slate-950 font-black shadow"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {cnt} Tim
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Cards Roster Grid */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {teams.map((team, tIdx) => {
                  const currentMember = team.members[team.currentMemberIndex % (team.members.length || 1)];

                  return (
                    <div
                      key={team.id}
                      className={`rounded-2xl p-4 border bg-gradient-to-b from-white/10 to-slate-900/90 ${team.accentBorder} flex flex-col justify-between`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={team.name}
                            onChange={(e) => {
                              const newName = e.target.value;
                              setTeams((prev) =>
                                prev.map((t) => (t.id === team.id ? { ...t, name: newName } : t)),
                              );
                            }}
                            className="bg-transparent font-black text-sm text-white focus:outline-hidden focus:border-b border-white/40 w-full"
                          />
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded text-white ${team.badgeBg}`}>
                            #{tIdx + 1}
                          </span>
                        </div>

                        <div className="mt-2 text-xs bg-white/5 p-2 rounded-xl border border-white/5">
                          <span className="text-[10px] text-slate-400 uppercase font-black block">
                            Pemain Pertama / Saat Ini:
                          </span>
                          <span className="font-bold text-emerald-300 truncate block">
                            {currentMember?.name || "(Belum ada siswa)"}
                          </span>
                        </div>

                        <div className="mt-3">
                          <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Anggota ({team.members.length} siswa):
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                            {team.members.length === 0 ? (
                              <p className="text-[11px] text-slate-500 italic">Belum ada anggota.</p>
                            ) : (
                              team.members.map((m, mIdx) => (
                                <div
                                  key={m.id}
                                  className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs transition ${
                                    mIdx === team.currentMemberIndex % team.members.length
                                      ? "bg-emerald-500/30 text-white font-black border border-emerald-400/50"
                                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleSetActiveMember(team.id, mIdx)}
                                    title="Klik untuk jadikan pemain aktif sekarang"
                                    className="truncate text-start flex-1"
                                  >
                                    {mIdx + 1}. {m.name}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStudent(m.id)}
                                    className="text-rose-400 hover:text-rose-200 text-xs px-1"
                                    title="Hapus dari tim ini"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-center text-[11px] text-slate-400">
                        <span>Total: {team.members.length} anak</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Student Manually Box */}
              <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Tambah nama siswa manual..."
                  value={newStudentNameInput}
                  onChange={(e) => setNewStudentNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddManualStudent();
                  }}
                  className="rounded-xl bg-slate-800 border border-white/20 px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-hidden flex-1 min-w-[200px]"
                />
                <select
                  value={targetTeamForNewStudent}
                  onChange={(e) => setTargetTeamForNewStudent(e.target.value)}
                  className="rounded-xl bg-slate-800 border border-white/20 px-3 py-2 text-xs text-white"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddManualStudent}
                  className="rounded-xl bg-white/20 px-4 py-2 text-xs font-bold text-white hover:bg-white/30"
                >
                  + Tambah Siswa
                </button>
              </div>
            </div>

            {/* Launch Big Screen Button */}
            <button
              type="button"
              disabled={!hasMinimumQuestions && teamCount === 4}
              onClick={() => {
                setGameStarted(true);
                playSfx("whistle");
              }}
              className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-10 py-4 text-xl font-black text-white shadow-2xl transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              <span>🚀 Mulai di Proyektor Sekarang</span>
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
            Selamat kepada seluruh tim dan siswa yang telah berjuang luar biasa!
          </p>

          {/* Winner Banner */}
          {winner && (
            <div className={`mt-8 rounded-3xl p-6 bg-gradient-to-r ${winner.color} text-white shadow-2xl`}>
              <div className="text-xs uppercase font-black tracking-widest opacity-80">
                🥇 JUARA 1 KELAS
              </div>
              <div className="mt-2 text-3xl sm:text-4xl font-black">{winner.name}</div>
              <div className="mt-2 text-xl font-black">
                {winner.score} Poin • {winner.correctCount} Jawaban Benar
              </div>
              {winner.members.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/20 text-xs text-white/90">
                  Anggota Tim: {winner.members.map((m) => m.name).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Leaderboard Table of Teams */}
          <div className="mt-6 rounded-2xl bg-slate-900/80 p-4 border border-white/10 text-start">
            <h3 className="text-xs font-black uppercase text-slate-400 mb-2">Peringkat Lengkap:</h3>
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
                    <div>
                      <div className="text-white">{team.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {team.members.length} anggota • {team.correctCount} benar
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-xl font-black text-emerald-400">
                    {team.score} Pts
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
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-3 sm:p-5 text-white flex flex-col justify-between"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* TOP PROJECTOR HUD */}
      <header className="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4 backdrop-blur shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-black">
              PUTARAN {currentRoundOffset + 1} / {Math.ceil(questions.length / teams.length)}
            </span>
            <h1 className="text-base sm:text-lg font-black truncate max-w-xs sm:max-w-md">
              {gameName}
            </h1>
          </div>

          {/* Remote HP Wireless Controllers Badge */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRemoteInfoModal(true)}
              className="rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-3 py-1.5 text-xs font-black text-white shadow hover:scale-105 transition flex items-center gap-1.5"
            >
              <span>🎮</span>
              <span>Stik Remote HP ({activeControllers.length}/4)</span>
            </button>

            <div className="flex rounded-xl bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setLayoutMode("focus")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  layoutMode === "focus"
                    ? "bg-violet-600 text-white font-black shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                📺 Fokus 1 Tim
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("split")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  layoutMode === "split"
                    ? "bg-emerald-600 text-white font-black shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                ⊞ Terbagi 4 Kuadran
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowTeamStudioModal(true)}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 flex items-center gap-1.5"
              title="Kelola Tim & Siswa"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Kelola Tim</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
              title="Layar Penuh"
            >
              {isFullscreen ? "🗗" : "⛶"}
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

        {/* INTERACTIVE TEAM TABS & TURN SELECTOR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10">
          {teams.map((t, idx) => {
            const hasAnswered = Boolean(questionAnswers[t.id]);
            const ans = questionAnswers[t.id];
            const isTurn = currentTurnIdx === idx;
            const currentMem = t.members[t.currentMemberIndex % (t.members.length || 1)];
            const isControllerActive = activeControllers.includes(t.id);

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setCurrentTurnIdx(idx);
                  setShowAnswerFeedback(false);
                  setSelectedOptionId(null);
                }}
                className={`text-start rounded-xl p-2.5 transition-all border-2 relative overflow-hidden ${
                  isTurn
                    ? `border-white bg-gradient-to-r ${t.color} text-white shadow-lg scale-102 z-10`
                    : hasAnswered
                    ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs truncate">{t.name}</span>
                    {isControllerActive && (
                      <span className="text-[10px]" title="Stik HP Terhubung">
                        🎮
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-black">
                    {t.score} pts
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="truncate opacity-80 font-bold">
                    👤 {currentMem?.name || "Pemain"}
                  </span>
                  <span>
                    {hasAnswered ? (
                      ans?.isCorrect ? (
                        <span className="text-emerald-400 font-bold">
                          {ans.speedBonus > 0 ? "⚡ Tercepat" : "✅ Benar"}
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold">❌ Salah</span>
                      )
                    ) : isTurn ? (
                      <span className="text-amber-300 font-black animate-pulse">👉 Giliran</span>
                    ) : (
                      <span className="text-slate-500">Menunggu</span>
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </header>

      {/* CENTRAL GAMEPLAY ARENA */}
      <section className="my-3 flex-1 flex flex-col justify-center">
        {layoutMode === "split" ? (
          /* =====================================================================
             MODE B: 4-QUADRANT SPLIT SCREEN ARENA
             Each team has its own DIFFERENT question & options, with SPEED BONUS!
             ===================================================================== */
          <div className="space-y-4">
            {/* Speed Bonus Announcement Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 p-3 text-center border border-amber-500/40 shadow-xl backdrop-blur">
              <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center justify-center gap-2">
                <span>⚡ MODE 4 KUADRAN: SOAL BERBEDA UNTUK TIAP KELOMPOK • TERCEPAT DAPAT BONUS +50 POIN!</span>
              </span>
            </div>

            {/* 4 Quadrants Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {teams.map((t, tIdx) => {
                const teamQ = getQuestionForTeam(tIdx);
                const ans = questionAnswers[t.id];
                const hasAnswered = Boolean(ans);
                const currentMem = t.members[t.currentMemberIndex % (t.members.length || 1)];

                return (
                  <div
                    key={t.id}
                    className={`rounded-3xl p-4 border-2 transition-all shadow-2xl relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 ${
                      hasAnswered
                        ? ans?.isCorrect
                          ? "border-emerald-400 bg-emerald-950/30"
                          : "border-rose-400 bg-rose-950/30"
                        : t.accentBorder
                    }`}
                  >
                    {/* Quadrant Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${t.badgeBg}`} />
                        <span className="font-black text-sm text-white">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-300">
                          Pemain: <strong className="text-amber-300">{currentMem?.name || "Tim"}</strong>
                        </span>
                        <span className="font-mono text-sm font-black text-emerald-400 bg-black/40 px-2 py-0.5 rounded-lg">
                          {t.score} pts
                        </span>
                      </div>
                    </div>

                    {/* Question Headline for this specific team */}
                    <div className="my-2 p-2.5 rounded-xl bg-white/5 border border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Soal Tim #{tIdx + 1}:
                      </span>
                      <h3 className="font-black text-base sm:text-lg text-white leading-snug mt-0.5">
                        {teamQ?.question_text}
                      </h3>
                    </div>

                    {/* Quadrant Game Interface */}
                    <div className="py-2">
                      {hasAnswered ? (
                        /* Outcome Banner in Quadrant with Speed Bonus */
                        <div
                          className={`rounded-2xl p-5 text-center animate-in zoom-in-95 duration-200 ${
                            ans?.isCorrect ? "bg-emerald-600/30 text-white" : "bg-rose-600/30 text-white"
                          }`}
                        >
                          <div className="text-3xl">{ans?.isCorrect ? "🎉 ⚡" : "💥 🧤"}</div>
                          <div className="text-lg font-black mt-1">
                            {ans?.bonusTitle}
                          </div>
                          <div className="text-xs opacity-80 mt-1">
                            Pilihan: {ans?.optionKey} • Skor Putaran: +{ans?.score}
                          </div>
                        </div>
                      ) : selectedMechanic === "penalty" ? (
                        /* Mini Penalty Shootout in Quadrant */
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold text-center text-emerald-300">
                            ⚽ Pilih Bola untuk Menendang ke Gawang:
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {teamQ?.options.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleAnswerForTeam(t.id, opt.id, opt.option_key)}
                                className="group flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-emerald-600/40 p-2.5 text-start border border-white/20 transition active:scale-95 cursor-pointer"
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 font-black text-xs shadow group-hover:scale-110">
                                  ⚽
                                </span>
                                <div className="truncate flex-1">
                                  <span className="text-[10px] font-mono text-emerald-300 block">
                                    Bola {opt.option_key}
                                  </span>
                                  <span className="text-xs font-bold text-white truncate block">
                                    {opt.option_text}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : selectedMechanic === "slicer" ? (
                        /* Mini Slicer in Quadrant */
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold text-center text-amber-300">
                            🍉 Tebas Buah Kata yang Benar (Awas Bom 💣!):
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {teamQ?.options.map((opt) => {
                              const isCorrect = opt.option_key === teamQ.correct_option_key;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleAnswerForTeam(t.id, opt.id, opt.option_key)}
                                  className="group flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-amber-600/40 p-2.5 text-start border border-white/20 transition active:scale-95 cursor-pointer"
                                >
                                  <span className="text-xl group-hover:scale-125 transition">
                                    {isCorrect ? "🍉" : "💣"}
                                  </span>
                                  <div className="truncate flex-1">
                                    <span className="text-[10px] font-mono text-amber-300 block">
                                      {opt.option_key}
                                    </span>
                                    <span className="text-xs font-bold text-white truncate block">
                                      {opt.option_text}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Standard MCQ in Quadrant */
                        <div className="grid grid-cols-2 gap-2">
                          {teamQ?.options.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleAnswerForTeam(t.id, opt.id, opt.option_key)}
                              className="flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-violet-600/40 p-2.5 text-start border border-white/20 transition active:scale-95"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/20 font-black text-xs text-white">
                                {opt.option_key}
                              </span>
                              <span className="text-xs font-bold text-white truncate flex-1">
                                {opt.option_text}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* =====================================================================
             MODE A: FULL ARENA FOCUS TURN
             Full immersive game player with round-robin fair turns for each team
             ===================================================================== */
          <div className="space-y-4">
            {/* Active Team Headline Banner */}
            <div
              className={`rounded-2xl p-3 bg-gradient-to-r ${activeTeam?.color} text-white font-black text-center shadow-lg flex items-center justify-between px-6`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">👉</span>
                <span className="text-base sm:text-lg">GILIRAN: {activeTeam?.name}</span>
              </div>
              <div className="text-xs sm:text-sm bg-black/30 px-3 py-1 rounded-xl">
                Pemain di Papan: <strong className="text-amber-300">{activeStudentName}</strong>
              </div>
            </div>

            {/* Mechanics Render */}
            {selectedMechanic === "runner" ? (
              <RunnerPlayer
                key={`${activeQuestion?.id}-${activeTeam.id}`}
                question={activeQuestion}
                session={mockSessionContext}
                onSubmitAnswer={async (payload) => {
                  handleAnswerForTeam(activeTeam.id, payload.selectedOptionId, null);
                  return { accepted: true, isCorrect: true, scoreAwarded: 100 };
                }}
                isRtl={Boolean(isRtl)}
              />
            ) : selectedMechanic === "slicer" ? (
              <SlicerPlayer
                key={`${activeQuestion?.id}-${activeTeam.id}`}
                question={activeQuestion}
                session={mockSessionContext}
                onSubmitAnswer={async (payload) => {
                  handleAnswerForTeam(activeTeam.id, payload.selectedOptionId, null);
                  return { accepted: true, isCorrect: true, scoreAwarded: 100 };
                }}
                isRtl={Boolean(isRtl)}
              />
            ) : selectedMechanic === "matching" ? (
              <MatchingPlayer
                key={`${activeQuestion?.id}-${activeTeam.id}`}
                question={activeQuestion}
                session={mockSessionContext}
                onSubmitAnswer={async (payload) => {
                  handleAnswerForTeam(activeTeam.id, payload.selectedOptionId, null);
                  return { accepted: true, isCorrect: true, scoreAwarded: 100 };
                }}
                isRtl={Boolean(isRtl)}
              />
            ) : selectedMechanic === "penalty" ? (
              <PenaltyPlayer
                key={`${activeQuestion?.id}-${activeTeam.id}`}
                question={activeQuestion}
                session={mockSessionContext}
                onSubmitAnswer={async (payload) => {
                  handleAnswerForTeam(activeTeam.id, payload.selectedOptionId, null);
                  return { accepted: true, isCorrect: true, scoreAwarded: 100 };
                }}
                isRtl={Boolean(isRtl)}
              />
            ) : (
              /* Big Projector Quiz Layout */
              <div className="space-y-6 max-w-4xl mx-auto w-full">
                <div className="rounded-3xl bg-white/10 p-6 sm:p-10 text-center border border-white/20 shadow-2xl backdrop-blur">
                  <span className="inline-block rounded-full bg-violet-500/20 px-4 py-1 text-xs font-bold text-violet-300">
                    Pertanyaan Tim #{currentTurnIdx + 1}
                  </span>
                  <h2 className="mt-4 text-3xl sm:text-5xl font-black leading-relaxed text-white">
                    {activeQuestion?.question_text}
                  </h2>
                </div>

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
                        onClick={() => handleAnswerForTeam(activeTeam.id, opt.id, opt.option_key)}
                        className={`flex items-center gap-4 rounded-3xl p-5 text-start font-black text-xl transition-all border-2 active:scale-98 cursor-pointer ${cardStyle}`}
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
          </div>
        )}
      </section>

      {/* FOOTER ACTIONS BAR */}
      <footer className="rounded-2xl p-3 sm:p-4 bg-slate-900/90 border border-white/20 backdrop-blur shadow-2xl flex flex-wrap items-center justify-between gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-black">
            {answeredTeamCount}/{teams.length}
          </span>
          <div className="text-xs">
            <span className="font-bold text-white block">
              {allTeamsAnsweredCurrentQ
                ? "🎉 Seluruh Tim Telah Menjawab Putaran Ini!"
                : `Menunggu ${teams.length - answeredTeamCount} tim lagi pada putaran ini`}
            </span>
            <span className="text-slate-400 text-[11px]">
              Siswa dapat memencet tombol di layar atau lewat Remote HP (/controller).
            </span>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          {!allTeamsAnsweredCurrentQ && (
            <button
              type="button"
              onClick={handleNextTeamTurn}
              className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-black text-white hover:bg-sky-500 transition shadow"
            >
              👉 Lanjut Giliran Tim Berikutnya
            </button>
          )}

          <button
            type="button"
            onClick={handleNextQuestion}
            className={`rounded-xl px-6 py-2.5 text-sm font-black text-white shadow-xl transition active:scale-95 ${
              allTeamsAnsweredCurrentQ
                ? "bg-emerald-500 hover:bg-emerald-600 animate-pulse"
                : "bg-white/20 hover:bg-white/30"
            }`}
          >
            {currentRoundOffset + 1 < Math.ceil(questions.length / teams.length)
              ? "Lanjut Putaran Soal Berikutnya →"
              : "Selesaikan Pertandingan 🏆"}
          </button>
        </div>
      </footer>

      {/* REMOTE HP INFORMATION MODAL */}
      {showRemoteInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl text-center">
            <div className="text-5xl animate-bounce">📱🎮</div>
            <h3 className="text-2xl font-black text-white mt-2">Remote Wireless HP Siswa</h3>
            <p className="text-xs text-slate-300 mt-1">
              Siswa atau perwakilan tim dapat membuka link berikut di HP masing-masing untuk bermain layaknya stik konsol game!
            </p>

            <div className="my-5 p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <span className="text-[11px] uppercase font-bold text-slate-400 block">Link Akses di Browser HP:</span>
              <div className="mt-1 text-lg font-mono font-black text-emerald-400 select-all">
                magguru.web.id/controller
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">atau ketik /remote di browser</span>
              <div className="mt-2 inline-block rounded-xl bg-violet-600/40 px-3 py-1 text-xs font-mono font-bold text-violet-200">
                Kode Ruangan: <strong>{roomCode}</strong>
              </div>
            </div>

            {/* Controller Connection Status */}
            <div className="space-y-2 text-start">
              <span className="text-xs font-bold text-slate-400 block">Status 4 Stik Nirkabel:</span>
              <div className="grid grid-cols-2 gap-2">
                {teams.map((t) => {
                  const isConnected = activeControllers.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                        isConnected
                          ? "border-emerald-400 bg-emerald-950/40 text-emerald-300"
                          : "border-white/10 bg-white/5 text-slate-400"
                      }`}
                    >
                      <span className="truncate">{t.name}</span>
                      <span>{isConnected ? "✅ Tersambung" : "⏳ Menunggu"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRemoteInfoModal(false)}
                className="rounded-xl bg-white px-6 py-2.5 text-xs font-black text-slate-900 hover:bg-slate-100"
              >
                Tutup & Kembali ke Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEAM STUDIO MODAL */}
      {showTeamStudioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h3 className="text-xl font-black text-white">⚙️ Studio Kelola Tim & Siswa</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Atur ulang tim, ubah nama, ganti pemain aktif, atau bagi rata siswa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTeamStudioModal(false)}
                className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-3 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">Kelas:</span>
                  {teacherClasses.length > 0 && (
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="rounded-xl bg-slate-800 border border-white/20 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {teacherClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({allStudents.filter((s) => s.class_id === c.id).length} siswa)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAutoDistributeStudents}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700"
                  >
                    🎲 Bagi Rata & Acak Ulang
                  </button>
                </div>
              </div>

              {/* Teams Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {teams.map((t, idx) => {
                  const currentMember = t.members[t.currentMemberIndex % (t.members.length || 1)];

                  return (
                    <div
                      key={t.id}
                      className={`rounded-2xl p-4 border bg-slate-800/80 ${t.accentBorder} flex flex-col justify-between`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={t.name}
                            onChange={(e) => {
                              const newName = e.target.value;
                              setTeams((prev) =>
                                prev.map((item) => (item.id === t.id ? { ...item, name: newName } : item)),
                              );
                            }}
                            className="bg-transparent font-black text-xs text-white focus:outline-hidden border-b border-white/20 w-full"
                          />
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded text-white ${t.badgeBg}`}>
                            #{idx + 1}
                          </span>
                        </div>

                        <div className="mt-2 text-xs bg-black/40 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 uppercase font-black block">
                            Pemain Aktif:
                          </span>
                          <span className="font-bold text-emerald-300 truncate block">
                            {currentMember?.name || "(Belum ada)"}
                          </span>
                        </div>

                        <div className="mt-3">
                          <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Anggota ({t.members.length}):
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                            {t.members.map((m, mIdx) => (
                              <div
                                key={m.id}
                                className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${
                                  mIdx === t.currentMemberIndex % t.members.length
                                    ? "bg-emerald-500/30 text-emerald-200 font-bold"
                                    : "bg-white/5 text-slate-300"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSetActiveMember(t.id, mIdx)}
                                  className="truncate text-start flex-1"
                                  title="Pilih sebagai pemain aktif"
                                >
                                  {mIdx + 1}. {m.name}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStudent(m.id)}
                                  className="text-rose-400 text-xs px-1"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-slate-400 flex justify-between">
                        <span>Skor: {t.score}</span>
                        <span>{t.members.length} siswa</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Student Manually */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Nama murid baru..."
                  value={newStudentNameInput}
                  onChange={(e) => setNewStudentNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddManualStudent();
                  }}
                  className="rounded-xl bg-slate-800 border border-white/20 px-3 py-2 text-xs text-white placeholder-slate-400 flex-1 min-w-[200px]"
                />
                <select
                  value={targetTeamForNewStudent}
                  onChange={(e) => setTargetTeamForNewStudent(e.target.value)}
                  className="rounded-xl bg-slate-800 border border-white/20 px-3 py-2 text-xs text-white"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddManualStudent}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  + Tambahkan
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTeamStudioModal(false)}
                className="rounded-xl bg-white px-6 py-2.5 text-xs font-black text-slate-900 hover:bg-slate-100"
              >
                Selesai & Lanjutkan Permainan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
