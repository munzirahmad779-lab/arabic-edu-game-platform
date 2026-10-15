"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Confetti } from "@/components/confetti";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { NormalizedGameType, RawQuestion } from "@/lib/game-engine/types";
import { CURATED_WEB_GAMES } from "@/lib/game-engine/curated-web-games";
import { WebGameEmbedPlayer } from "@/components/game-players/web-embed-player";
import { AirplanePlayer } from "@/components/game-players/airplane-player";
import { WhackPlayer } from "@/components/game-players/whack-player";
import { WheelPlayer } from "@/components/game-players/wheel-player";
import { MemoryPlayer } from "@/components/game-players/memory-player";
import { BalloonPlayer } from "@/components/game-players/balloon-player";

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
  colorName: string;
  themeGradient: string;
  badgeBg: string;
  accentBorder: string;
  textColor: string;
  cardBg: string;
  score: number;
  correctCount: number;
  streak: number;
  members: StudentMember[];
  currentMemberIndex: number;
};

export type ProjectorGameTheme = "kahoot" | "quiz";

// Kahoot 4 Iconic Cards Specifications
const KAHOOT_OPTIONS_SPEC = [
  { key: "A", shape: "▲", shapeName: "Segitiga", color: "bg-rose-600 hover:bg-rose-500 text-white", border: "border-rose-400/80" },
  { key: "B", shape: "◆", shapeName: "Ketupat", color: "bg-sky-600 hover:bg-sky-500 text-white", border: "border-sky-400/80" },
  { key: "C", shape: "●", shapeName: "Lingkaran", color: "bg-amber-500 hover:bg-amber-400 text-white", border: "border-amber-300/80" },
  { key: "D", shape: "■", shapeName: "Kotak", color: "bg-emerald-600 hover:bg-emerald-500 text-white", border: "border-emerald-400/80" },
];

const INITIAL_TEAMS: Array<Omit<ProjectorTeam, "members" | "currentMemberIndex" | "score" | "correctCount" | "streak">> = [
  {
    id: "team-1",
    name: "Tim Merah",
    colorName: "Merah",
    themeGradient: "from-rose-600 to-red-700",
    badgeBg: "bg-rose-600",
    accentBorder: "border-rose-500",
    textColor: "text-rose-400",
    cardBg: "bg-rose-950/40",
  },
  {
    id: "team-2",
    name: "Tim Biru",
    colorName: "Biru",
    themeGradient: "from-sky-600 to-blue-700",
    badgeBg: "bg-sky-600",
    accentBorder: "border-sky-500",
    textColor: "text-sky-400",
    cardBg: "bg-sky-950/40",
  },
  {
    id: "team-3",
    name: "Tim Kuning",
    colorName: "Kuning",
    themeGradient: "from-amber-500 to-yellow-600",
    badgeBg: "bg-amber-500",
    accentBorder: "border-amber-500",
    textColor: "text-amber-400",
    cardBg: "bg-amber-950/40",
  },
  {
    id: "team-4",
    name: "Tim Hijau",
    colorName: "Hijau",
    themeGradient: "from-emerald-600 to-teal-700",
    badgeBg: "bg-emerald-600",
    accentBorder: "border-emerald-500",
    textColor: "text-emerald-400",
    cardBg: "bg-emerald-950/40",
  },
];

type GamePhase = "question" | "reveal" | "leaderboard" | "finished";

type TeamAnswerRecord = {
  teamId: string;
  optionKey: string;
  isCorrect: boolean;
  scoreAwarded: number;
  speedBonus: number;
  answeredAt: number;
};

export function ProjectorScreen({
  gameId,
  gameName,
  initialGameTheme = "kahoot",
  questions,
  allStudents = [],
  teacherClasses = [],
  defaultClassId = "",
  isRtl = false,
}: {
  gameId?: string;
  gameName: string;
  initialGameType?: NormalizedGameType;
  initialGameTheme?: string;
  questions: RawQuestion[];
  allStudents?: StudentMember[];
  teacherClasses?: TeacherClass[];
  defaultClassId?: string;
  isRtl?: boolean;
}) {
  // Core Game State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("question");
  const [gameStarted, setGameStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeEngine, setActiveEngine] = useState<
    "kahoot" | "airplane" | "whack" | "wheel" | "memory" | "balloon"
  >(() => {
    if (initialGameTheme === "airplane") return "airplane";
    if (initialGameTheme === "whack") return "whack";
    if (initialGameTheme === "wheel") return "wheel";
    if (initialGameTheme === "memory") return "memory";
    if (initialGameTheme === "balloon") return "balloon";
    return "kahoot";
  });

  // Teams (4 Teams)
  const [teams, setTeams] = useState<ProjectorTeam[]>(() =>
    INITIAL_TEAMS.map((cfg) => ({
      ...cfg,
      score: 0,
      correctCount: 0,
      streak: 0,
      members: [],
      currentMemberIndex: 0,
    })),
  );

  // Answer records for current question
  const [answers, setAnswers] = useState<Record<string, TeamAnswerRecord>>({});
  const [correctArrivalOrder, setCorrectArrivalOrder] = useState<string[]>([]);

  // Timer Configuration
  const QUESTION_DURATION = 20;
  const [timerSeconds, setTimerSeconds] = useState(QUESTION_DURATION);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  // Classroom Modals
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId || teacherClasses[0]?.id || "");
  const [showClassModal, setShowClassModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("team-1");

  // Web Game Embed Modal
  const [showWebGameModal, setShowWebGameModal] = useState(false);
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string | null>(null);

  // Phone Controller State
  const roomCode = useMemo(() => {
    if (!gameId || gameId.startsWith("test-")) return "HOTSEAT";
    return gameId.slice(0, 6).toUpperCase();
  }, [gameId]);
  const [activeControllers, setActiveControllers] = useState<string[]>([]);
  const lastEventTimestampRef = useRef<number>(Date.now());
  const [controllerOrigin, setControllerOrigin] = useState("https://magguru.web.id");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setControllerOrigin(window.location.origin);
    }
  }, []);

  // Filter students based on selected class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return allStudents;
    return allStudents.filter((s) => s.class_id === selectedClassId);
  }, [allStudents, selectedClassId]);

  // Auto-distribute students across 4 teams
  const distributeStudents = useCallback(() => {
    const pool = [...classStudents].sort(() => Math.random() - 0.5);
    setTeams((prev) => {
      const next = prev.map((t) => ({ ...t, members: [] as StudentMember[], currentMemberIndex: 0 }));
      pool.forEach((s, i) => {
        const team = next[i % next.length];
        if (team) team.members.push(s);
      });
      return next;
    });
    playSfx("correct");
  }, [classStudents]);

  useEffect(() => {
    if (classStudents.length > 0 && teams.every((t) => t.members.length === 0)) {
      distributeStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classStudents]);

  // Fullscreen listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Safe active question resolver
  const activeQuestion: RawQuestion = useMemo(() => {
    if (!questions || questions.length === 0) {
      return {
        id: "empty",
        position: 0,
        question_text: "Belum ada soal kuis yang dimuat.",
        difficulty: "easy",
        correct_option_key: "A",
        explanation: "Tambahkan soal melalui bank soal atau menu kuis guru.",
        options: [
          { id: "1", option_key: "A", option_text: "Pilihan A" },
          { id: "2", option_key: "B", option_text: "Pilihan B" },
          { id: "3", option_key: "C", option_text: "Pilihan C" },
          { id: "4", option_key: "D", option_text: "Pilihan D" },
        ],
      };
    }
    return questions[currentQuestionIndex % questions.length]!;
  }, [questions, currentQuestionIndex]);

  const totalQuestions = questions.length || 1;
  const correctOptionKey = (activeQuestion.correct_option_key ?? "A").toUpperCase().trim();

  // Handle Team Answer
  const handleRecordAnswer = useCallback(
    (teamId: string, optionKey: string) => {
      if (phase !== "question") return;
      if (answers[teamId]) return;

      const keyUpper = optionKey.toUpperCase().trim();
      const isCorrect = keyUpper === correctOptionKey;

      let speedBonus = 0;
      if (isCorrect) {
        const arrivalRank = correctArrivalOrder.length + 1;
        if (arrivalRank === 1) speedBonus = 50;
        else if (arrivalRank === 2) speedBonus = 25;
        setCorrectArrivalOrder((prev) => [...prev, teamId]);
      }

      const scoreAwarded = isCorrect ? 100 + speedBonus : -25;

      const record: TeamAnswerRecord = {
        teamId,
        optionKey: keyUpper,
        isCorrect,
        scoreAwarded,
        speedBonus,
        answeredAt: Date.now(),
      };

      setAnswers((prev) => ({ ...prev, [teamId]: record }));

      setTeams((prev) =>
        prev.map((t) => {
          if (t.id === teamId) {
            return {
              ...t,
              score: Math.max(0, t.score + scoreAwarded),
              correctCount: t.correctCount + (isCorrect ? 1 : 0),
              streak: isCorrect ? t.streak + 1 : 0,
              currentMemberIndex: t.currentMemberIndex + 1,
            };
          }
          return t;
        }),
      );

      if (isCorrect) {
        if (speedBonus > 0) playSfx("boost");
        else playSfx("correct");
      } else {
        playSfx("wrong");
      }
    },
    [phase, answers, correctOptionKey, correctArrivalOrder.length],
  );

  const triggerRevealPhase = useCallback(() => {
    setPhase("reveal");
    setIsTimerPaused(true);
    playSfx("click");
  }, []);

  // Check if all teams answered -> trigger reveal automatically
  useEffect(() => {
    if (phase === "question" && gameStarted) {
      const answeredCount = Object.keys(answers).length;
      if (answeredCount >= teams.length && teams.length > 0) {
        const timeout = setTimeout(() => {
          triggerRevealPhase();
        }, 600);
        return () => clearTimeout(timeout);
      }
    }
  }, [answers, phase, gameStarted, teams.length, triggerRevealPhase]);

  // STABLE TIMER
  useEffect(() => {
    if (!gameStarted || phase !== "question" || isTimerPaused) return;

    const timer = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          playSfx("wrong");
          setTimeout(() => {
            triggerRevealPhase();
          }, 400);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, phase, isTimerPaused, triggerRevealPhase]);

  // Advance to Leaderboard Phase
  const handleGoToLeaderboard = () => {
    setPhase("leaderboard");
    playSfx("boost");
  };

  // Advance to Next Question
  const handleGoToNextQuestion = () => {
    if (currentQuestionIndex + 1 < totalQuestions) {
      setCurrentQuestionIndex((idx) => idx + 1);
      setAnswers({});
      setCorrectArrivalOrder([]);
      setTimerSeconds(QUESTION_DURATION);
      setIsTimerPaused(false);
      setPhase("question");
      playSfx("click");
    } else {
      setPhase("finished");
      playSfx("boost");
    }
  };

  // Restart match
  const handleRestartGame = () => {
    setTeams((prev) =>
      prev.map((t) => ({ ...t, score: 0, correctCount: 0, streak: 0, currentMemberIndex: 0 })),
    );
    setCurrentQuestionIndex(0);
    setAnswers({});
    setCorrectArrivalOrder([]);
    setTimerSeconds(QUESTION_DURATION);
    setIsTimerPaused(false);
    setPhase("question");
  };

  // Wireless Phone Controller Poller
  useEffect(() => {
    if (!gameStarted || phase === "finished") return;

    const interval = setInterval(async () => {
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
            if (ev.action === "press" && ev.teamId && ev.optionKey && phase === "question") {
              handleRecordAnswer(ev.teamId, ev.optionKey);
            }
          }
        }
      } catch {
        // network polling silent catch
      }
    }, 350);

    return () => clearInterval(interval);
  }, [gameStarted, phase, roomCode, handleRecordAnswer]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (phase === "reveal") {
          handleGoToLeaderboard();
        } else if (phase === "leaderboard") {
          handleGoToNextQuestion();
        }
      } else if (e.key.toLowerCase() === "p" && phase === "question") {
        setIsTimerPaused((prev) => !prev);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const sortedLeaderboard = useMemo(() => {
    return [...teams].sort((a, b) => b.score - a.score);
  }, [teams]);

  const answeredCount = Object.keys(answers).length;

  // If teacher opened a direct web game embed in-session:
  if (activeEmbedUrl) {
    return (
      <div className="relative w-full h-screen bg-black">
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveEmbedUrl(null)}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition"
          >
            ✕ Tutup Web Game & Kembali ke Proyektor
          </button>
        </div>
        <WebGameEmbedPlayer embedUrl={activeEmbedUrl} title={gameName} />
      </div>
    );
  }

  // If teacher selected a Native Arcade Game Engine:
  if (activeEngine === "airplane") {
    return (
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between">
        <header className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✈️</span>
            <div>
              <h2 className="text-base font-black text-white">Pesawat Terbang Awan (Arkade 60 FPS)</h2>
              <p className="text-xs text-sky-400">{gameName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveEngine("kahoot")}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
          >
            ← Kembali ke Kahoot Arena
          </button>
        </header>
        <AirplanePlayer questions={questions} onFinish={() => setPhase("finished")} isRtl={isRtl} />
      </main>
    );
  }

  if (activeEngine === "whack") {
    return (
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between">
        <header className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔨</span>
            <div>
              <h2 className="text-base font-black text-white">Pukul Tikus Kosakata (Whack-a-Mole)</h2>
              <p className="text-xs text-amber-400">{gameName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveEngine("kahoot")}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
          >
            ← Kembali ke Kahoot Arena
          </button>
        </header>
        <WhackPlayer questions={questions} onFinish={() => setPhase("finished")} isRtl={isRtl} />
      </main>
    );
  }

  if (activeEngine === "wheel") {
    return (
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between">
        <header className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎡</span>
            <div>
              <h2 className="text-base font-black text-white">Roda Putar Fisika Karnaval (Wheel of Fortune)</h2>
              <p className="text-xs text-yellow-400">{gameName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveEngine("kahoot")}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
          >
            ← Kembali ke Kahoot Arena
          </button>
        </header>
        <WheelPlayer questions={questions} onFinish={() => setPhase("finished")} isRtl={isRtl} />
      </main>
    );
  }

  if (activeEngine === "memory") {
    return (
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between">
        <header className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🃏</span>
            <div>
              <h2 className="text-base font-black text-white">Kartu Memori Flip 3D (Mufrodat)</h2>
              <p className="text-xs text-purple-400">{gameName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveEngine("kahoot")}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
          >
            ← Kembali ke Kahoot Arena
          </button>
        </header>
        <MemoryPlayer questions={questions} onFinish={() => setPhase("finished")} isRtl={isRtl} />
      </main>
    );
  }

  if (activeEngine === "balloon") {
    return (
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between">
        <header className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎈</span>
            <div>
              <h2 className="text-base font-black text-white">Pecahkan Balon Jawaban (Balloon Pop)</h2>
              <p className="text-xs text-sky-400">{gameName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveEngine("kahoot")}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
          >
            ← Kembali ke Kahoot Arena
          </button>
        </header>
        <BalloonPlayer questions={questions} onFinish={() => setPhase("finished")} isRtl={isRtl} />
      </main>
    );
  }

  // -------------------------------------------------------------
  // LOBBY PHASE (Before Start)
  // -------------------------------------------------------------
  if (!gameStarted) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 md:p-8 select-none relative overflow-hidden font-sans">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-600/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 blur-3xl rounded-full pointer-events-none" />

        {/* Top Header */}
        <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📽️</span>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-wide">{gameName}</h1>
              <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                Kahoot Arena Panggung Proyektor & Remote HP Nirkabel
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/10">
              <span className="text-[11px] font-bold text-slate-400 px-1">Game:</span>
              <button
                type="button"
                onClick={() => setActiveEngine("airplane")}
                className="px-2 py-1 rounded-xl bg-sky-600/30 hover:bg-sky-600/60 text-sky-200 border border-sky-400/40 text-xs font-bold transition flex items-center gap-1"
              >
                <span>✈️</span>
                <span>Pesawat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveEngine("whack")}
                className="px-2 py-1 rounded-xl bg-amber-600/30 hover:bg-amber-600/60 text-amber-200 border border-amber-400/40 text-xs font-bold transition flex items-center gap-1"
              >
                <span>🔨</span>
                <span>Pukul Tikus</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveEngine("wheel")}
                className="px-2 py-1 rounded-xl bg-yellow-600/30 hover:bg-yellow-600/60 text-yellow-200 border border-yellow-400/40 text-xs font-bold transition flex items-center gap-1"
              >
                <span>🎡</span>
                <span>Roda</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveEngine("memory")}
                className="px-2 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/60 text-purple-200 border border-purple-400/40 text-xs font-bold transition flex items-center gap-1"
              >
                <span>🃏</span>
                <span>Memori</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveEngine("balloon")}
                className="px-2 py-1 rounded-xl bg-rose-600/30 hover:bg-rose-600/60 text-rose-200 border border-rose-400/40 text-xs font-bold transition flex items-center gap-1"
              >
                <span>🎈</span>
                <span>Balon</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowClassModal(true)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition border border-white/10 flex items-center gap-1.5"
            >
              <span>👥</span>
              <span>Kelola Tim ({classStudents.length} Siswa)</span>
            </button>

            <Link
              href="/dashboard/games"
              className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition"
            >
              Kembali
            </Link>
          </div>
        </header>

        {/* Center: Hero Controller Join Box & 4 Team Podiums */}
        <div className="relative z-10 max-w-5xl mx-auto w-full my-auto py-6 space-y-6">
          <div className="p-6 md:p-8 rounded-3xl bg-slate-900/90 border-2 border-emerald-500/40 shadow-2xl backdrop-blur text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black">
              <span>🎮</span>
              <span>STIK KONTROLER HP SISWA (/controller)</span>
            </div>

            <h2 className="text-2xl md:text-4xl font-black text-white">
              Buka di HP Siswa: <span className="text-emerald-400 underline font-mono">{controllerOrigin}/controller</span>
            </h2>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <div className="px-5 py-3 rounded-2xl bg-black/50 border border-white/20 text-center">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">KODE ROOM</span>
                <span className="text-2xl md:text-3xl font-black font-mono text-amber-400">{roomCode}</span>
              </div>
              <div className="px-5 py-3 rounded-2xl bg-black/50 border border-white/20 text-center">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">STIK TERHUBUNG</span>
                <span className="text-2xl md:text-3xl font-black font-mono text-emerald-400">{activeControllers.length} HP</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              Siswa membuka tautan kontroler di browser HP masing-masing, memilih timnya, dan langsung siap menekan tombol warna saat kuis dimulai.
            </p>
          </div>

          {/* 4 Teams Podiums */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {teams.map((t) => (
              <div
                key={t.id}
                className={`p-4 rounded-2xl border ${t.cardBg} ${t.accentBorder} shadow-lg flex flex-col justify-between min-h-[140px]`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${t.badgeBg}`} />
                    <span className="font-black text-sm text-white">{t.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    {t.members.length} Siswa
                  </span>
                </div>

                <div className="my-2 max-h-24 overflow-y-auto text-xs space-y-1 text-slate-300 pr-1">
                  {t.members.length > 0 ? (
                    t.members.slice(0, 5).map((m) => (
                      <div key={m.id} className="truncate bg-black/30 px-2 py-0.5 rounded">
                        • {m.name}
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">Belum ada anggota</span>
                  )}
                  {t.members.length > 5 && (
                    <span className="text-[10px] text-slate-400 italic block">
                      +{t.members.length - 5} lainnya
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTargetTeamId(t.id);
                    setShowClassModal(true);
                  }}
                  className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition text-center"
                >
                  + Tambah Siswa
                </button>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={distributeStudents}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition flex items-center gap-2"
            >
              <span>🎲</span>
              <span>Acak Siswa Kelas ({classStudents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setGameStarted(true);
                playSfx("boost");
              }}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-base shadow-xl transition hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <span>▶️</span>
              <span>MULAI KUIS KELAS ({totalQuestions} SOAL)</span>
            </button>
          </div>
        </div>

        {/* Modal: Kelola Siswa */}
        {showClassModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 max-w-lg w-full space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">Kelola Pembagian Tim</h3>
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Pilih Kelas:</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-white/10 text-white text-sm"
                >
                  {teacherClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama siswa manual..."
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="flex-1 p-2.5 rounded-xl bg-slate-800 border border-white/10 text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newStudentName.trim()) return;
                    setTeams((prev) =>
                      prev.map((t) =>
                        t.id === targetTeamId
                          ? {
                              ...t,
                              members: [
                                ...t.members,
                                {
                                  id: `manual-${Date.now()}`,
                                  name: newStudentName.trim(),
                                  class_id: selectedClassId,
                                },
                              ],
                            }
                          : t,
                      ),
                    );
                    setNewStudentName("");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm"
                >
                  + Tambah
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="w-full py-2.5 rounded-xl bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Buka Web Game Embed */}
        {showWebGameModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 max-w-2xl w-full space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">🌐 Buka Web Game Pembelajaran Asli</h3>
                  <p className="text-xs text-slate-400">Pilih dari katalog 30 game atau tempel URL embed Wordwall/Educaplay/H5P:</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWebGameModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {CURATED_WEB_GAMES.slice(0, 12).map((wg) => (
                  <button
                    key={wg.id}
                    type="button"
                    onClick={() => {
                      setActiveEmbedUrl(wg.embedUrl);
                      setShowWebGameModal(false);
                    }}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-indigo-900/60 border border-white/10 hover:border-indigo-400 text-left transition flex flex-col justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{wg.thumbnailIcon}</span>
                      <span className="font-bold text-white truncate">{wg.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-indigo-300">{wg.platform}</span>
                      <span>{wg.category}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-white/10">
                <input
                  type="url"
                  placeholder="Tempel URL embed di sini (misal: https://wordwall.net/embed/...)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value) {
                      setActiveEmbedUrl((e.target as HTMLInputElement).value);
                      setShowWebGameModal(false);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-white/10 text-white text-xs placeholder-slate-500"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // -------------------------------------------------------------
  // FINISHED PHASE (Winner Podium)
  // -------------------------------------------------------------
  if (phase === "finished") {
    const winner = sortedLeaderboard[0];
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center relative select-none">
        <Confetti />
        <div className="max-w-2xl w-full p-8 rounded-3xl bg-slate-900/90 border border-amber-400/40 shadow-2xl backdrop-blur space-y-6 animate-in zoom-in-95">
          <span className="text-6xl animate-bounce block">🏆</span>
          <div>
            <span className="text-xs uppercase tracking-widest text-amber-400 font-bold block mb-1">JUARA PERTAMA</span>
            <h1 className="text-4xl md:text-5xl font-black text-white">{winner?.name ?? "Tim Juara"}</h1>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-2">{winner?.score ?? 0} Poin</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
            {sortedLeaderboard.map((t, idx) => (
              <div key={t.id} className={`p-3 rounded-xl border ${t.cardBg} ${t.accentBorder} text-center`}>
                <span className="text-xs font-mono font-bold text-amber-400 block">#{idx + 1}</span>
                <span className="text-xs font-black text-white truncate block">{t.name}</span>
                <span className="text-xs font-mono text-emerald-400 font-bold">{t.score} Pts</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleRestartGame}
              className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition"
            >
              🔄 Ulangi Kuis
            </button>
            <Link
              href="/dashboard/games"
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition shadow-lg"
            >
              Selesai & Keluar
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // LEADERBOARD PHASE (Mid-Game Rankings)
  // -------------------------------------------------------------
  if (phase === "leaderboard") {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 md:p-8 select-none relative font-sans">
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h2 className="text-lg font-black text-white uppercase tracking-wider">PAPAN KLASEMEN SEMENTARA</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Soal {currentQuestionIndex + 1} / {totalQuestions}</span>
        </header>

        <div className="max-w-3xl mx-auto w-full my-auto py-6 space-y-3">
          {sortedLeaderboard.map((team, idx) => (
            <div
              key={team.id}
              className={`p-4 md:p-5 rounded-2xl border-2 flex items-center justify-between transition-all shadow-xl ${team.cardBg} ${team.accentBorder}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center font-mono font-black text-amber-400 text-base">
                  #{idx + 1}
                </span>
                <div>
                  <h3 className="text-lg font-black text-white">{team.name}</h3>
                  <span className="text-xs text-slate-400">{team.correctCount} Jawaban Tepat</span>
                </div>
              </div>
              <span className="text-2xl font-black font-mono text-emerald-400">{team.score} Pts</span>
            </div>
          ))}
        </div>

        <footer className="flex items-center justify-center gap-4 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleGoToNextQuestion}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm shadow-xl transition hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <span>Soal Berikutnya</span>
            <span>→ (Spasi)</span>
          </button>
        </footer>
      </main>
    );
  }

  // -------------------------------------------------------------
  // ACTIVE QUESTION & REVEAL PHASE (Kahoot Arena Showdown)
  // -------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-3 md:p-6 select-none relative overflow-hidden font-sans">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-900/15 blur-[150px] pointer-events-none rounded-full" />

      {/* TOP HUD: Progress, Big Timer, Fullscreen */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        {/* Left: Question Progress */}
        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <span>SOAL</span>
            <span className="text-sm text-white font-mono">{currentQuestionIndex + 1} / {totalQuestions}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-400/40 text-emerald-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <span>▲</span>
            <span>Kahoot Arena Proyektor</span>
          </div>
        </div>

        {/* Center: BIG GLOWING COUNTDOWN TIMER */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-5 py-1 rounded-2xl border font-mono font-black text-xl transition-all duration-300 ${
              timerSeconds <= 5 && phase === "question"
                ? "bg-rose-600 text-white border-rose-400 shadow-[0_0_30px_rgba(225,29,72,0.6)] animate-pulse"
                : timerSeconds <= 10 && phase === "question"
                ? "bg-amber-500/20 text-amber-300 border-amber-400/50"
                : "bg-white/10 text-white border-white/20 shadow-lg"
            }`}
          >
            <span className="text-sm">⏱️</span>
            <span>{phase === "question" ? `${timerSeconds}s` : "SELESAI"}</span>
          </div>

          {phase === "question" && (
            <button
              type="button"
              onClick={() => setIsTimerPaused((p) => !p)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-xs text-slate-300 border border-white/10 transition"
              title={isTimerPaused ? "Lanjutkan Detik (P)" : "Jeda Detik (P)"}
            >
              {isTimerPaused ? "▶️" : "⏸️"}
            </button>
          )}
        </div>

        {/* Right: Answered Progress, Fullscreen */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-black font-mono transition ${
              answeredCount >= teams.length
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                : "bg-white/5 text-slate-300 border-white/10"
            }`}
          >
            {answeredCount} / {teams.length} Tim
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-xs text-slate-300 border border-white/10 transition"
            title="Layar Penuh TV / Projector (F)"
          >
            {isFullscreen ? "🗗" : "⛶"}
          </button>

          <Link
            href="/dashboard/games"
            className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition"
          >
            Keluar
          </Link>
        </div>
      </header>

      {/* Main Question & 4 Cards */}
      <section className="relative z-10 my-auto py-2 max-w-6xl mx-auto w-full flex flex-col gap-4">
        {/* Question Text Box */}
        <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-5 md:p-8 text-center shadow-2xl backdrop-blur relative">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-wide leading-relaxed py-2 drop-shadow-md select-text" dir="auto">
            {activeQuestion.question_text}
          </h2>
          {phase === "reveal" && (
            <div className="mt-3 p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs md:text-sm animate-in zoom-in-95">
              <span className="font-black text-emerald-400 block mb-0.5">💡 PEMBAHASAN / ARTI:</span>
              <p>{activeQuestion.explanation || "Jawaban yang benar adalah pilihan bertanda centang hijau di bawah."}</p>
            </div>
          )}
        </div>

        {/* 4 Iconic Kahoot Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-4">
          {KAHOOT_OPTIONS_SPEC.map((spec) => {
            const rawOpt = activeQuestion.options.find((o) => o.option_key.toUpperCase() === spec.key);
            const isThisOptionCorrect = spec.key === correctOptionKey;
            const teamsPickedThis = Object.values(answers).filter((ans) => ans.optionKey === spec.key);

            let cardStyle = spec.color;
            let borderStyle = spec.border;
            let opacityStyle = "opacity-100";

            if (phase === "reveal") {
              if (isThisOptionCorrect) {
                cardStyle = "bg-emerald-600 text-white";
                borderStyle = "border-emerald-300 ring-4 ring-emerald-400/60 shadow-[0_0_40px_rgba(16,185,129,0.5)]";
              } else {
                opacityStyle = "opacity-35 grayscale-[40%]";
              }
            }

            return (
              <div
                key={spec.key}
                className={`rounded-3xl p-4 md:p-6 border-2 transition-all duration-300 flex flex-col justify-between min-h-[110px] md:min-h-[135px] shadow-xl ${cardStyle} ${borderStyle} ${opacityStyle}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl md:text-3xl font-black">{spec.shape}</span>
                    <span className="text-xs md:text-sm font-black uppercase tracking-wider opacity-90">Pilihan {spec.key}</span>
                  </div>
                  {phase === "reveal" && isThisOptionCorrect && (
                    <span className="px-3 py-1 rounded-full bg-white text-emerald-900 text-xs font-black shadow-md flex items-center gap-1 animate-bounce">
                      <span>✓</span> BENAR
                    </span>
                  )}
                </div>
                <div className="text-xl md:text-2xl lg:text-3xl font-black leading-snug break-words" dir="auto">
                  {rawOpt?.option_text || `(Pilihan ${spec.key})`}
                </div>
                {teamsPickedThis.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/20 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold opacity-80">Dipilih:</span>
                    {teamsPickedThis.map((ans) => (
                      <span key={ans.teamId} className="px-2 py-0.5 rounded-lg bg-black/40 text-white font-black text-[11px]">
                        {teams.find((t) => t.id === ans.teamId)?.name} {phase === "reveal" && (ans.isCorrect ? "✓" : "✗")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer Podiums and Controls */}
      <footer className="relative z-20 border-t border-white/10 pt-3 mt-1">
        {phase === "reveal" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-white/15 p-3.5 rounded-2xl shadow-2xl mb-2 animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <p className="text-xs font-black text-white">Pembahasan Soal Selesai!</p>
                <p className="text-[11px] text-slate-400">Tekan tombol di bawah untuk melihat perolehan poin tim.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleGoToLeaderboard}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs shadow-lg transition hover:scale-105 active:scale-95 flex items-center gap-1.5"
              >
                <span>🏆</span>
                <span>Lihat Papan Skor (Spasi)</span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={handleGoToNextQuestion}
                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition border border-white/10"
              >
                Langsung Soal Berikutnya ⏩
              </button>
            </div>
          </div>
        ) : null}

        {/* 4 Teams Interactive Podiums */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {teams.map((team) => {
            const hasAnswered = Boolean(answers[team.id]);
            const ansRecord = answers[team.id];
            const currentStudent =
              team.members[team.currentMemberIndex % (team.members.length || 1)]?.name ||
              "Pemain Tim";

            return (
              <div
                key={team.id}
                className={`rounded-2xl p-2.5 border transition-all duration-300 flex flex-col justify-between ${team.cardBg} ${team.accentBorder} shadow-lg`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`w-2.5 h-2.5 rounded-full ${team.badgeBg}`} />
                    <span className="text-xs font-black text-white truncate">{team.name}</span>
                  </div>
                  <span className="text-xs font-black font-mono text-emerald-400">
                    {team.score} Pts
                  </span>
                </div>

                <div className="my-1 flex items-center justify-between text-[11px] text-slate-300 bg-black/30 px-2 py-0.5 rounded-lg">
                  <span className="truncate">👤 {currentStudent}</span>
                  {team.streak >= 2 && (
                    <span className="text-[10px] text-amber-300 font-bold">🔥 {team.streak}x</span>
                  )}
                </div>

                {hasAnswered ? (
                  <div
                    className={`text-center py-1 rounded-xl text-xs font-black transition ${
                      phase === "reveal"
                        ? ansRecord?.isCorrect
                          ? "bg-emerald-600 text-white"
                          : "bg-rose-600 text-white"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    }`}
                  >
                    {phase === "reveal" ? (
                      ansRecord?.isCorrect ? (
                        <span>✓ TEPAT ({ansRecord.optionKey}) +{ansRecord.scoreAwarded}</span>
                      ) : (
                        <span>✗ SALAH ({ansRecord?.optionKey})</span>
                      )
                    ) : (
                      <span>✓ TERKUNCI ({ansRecord?.optionKey})</span>
                    )}
                  </div>
                ) : phase === "question" ? (
                  <div className="flex gap-1 pt-0.5">
                    {KAHOOT_OPTIONS_SPEC.map((spec) => (
                      <button
                        key={spec.key}
                        type="button"
                        onClick={() => handleRecordAnswer(team.id, spec.key)}
                        className={`flex-1 py-1 rounded-lg text-xs font-black text-white transition hover:scale-105 active:scale-95 shadow-sm ${spec.color}`}
                        title={`Pilih ${spec.key} untuk ${team.name}`}
                      >
                        {spec.shape}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-0.5 text-[11px] text-slate-500 italic">
                    Waktu Habis
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </footer>
    </main>
  );
}
