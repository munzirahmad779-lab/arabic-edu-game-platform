"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Confetti } from "@/components/confetti";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { NormalizedGameType, RawQuestion } from "@/lib/game-engine/types";
import { WebGameEmbedPlayer } from "@/components/game-players/web-embed-player";
import { AirplanePlayer } from "@/components/game-players/airplane-player";
import { WhackPlayer } from "@/components/game-players/whack-player";
import { SpaceDefenderPlayer } from "@/components/game-players/space-defender-player";
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
  initialRoomCode,
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
  initialRoomCode?: string | null;
}) {
  // Core Game State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("question");
  const [gameStarted, setGameStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeEngine, setActiveEngine] = useState<
    "kahoot" | "airplane" | "whack" | "space" | "memory" | "balloon"
  >(() => {
    if (initialGameTheme === "airplane") return "airplane";
    if (initialGameTheme === "whack") return "whack";
    if (initialGameTheme === "space" || initialGameTheme === "wheel") return "space";
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

  // Classroom Modals & Student Management
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId || teacherClasses[0]?.id || "");
  const [manualStudents, setManualStudents] = useState<StudentMember[]>([]);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("team-1");

  // Web Game Embed State
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string | null>(null);

  // Phone Controller State
  const roomCode = useMemo(() => {
    if (initialRoomCode) return initialRoomCode.toUpperCase();
    if (!gameId || gameId.startsWith("test-")) return "HOTSEAT";
    return gameId.slice(0, 6).toUpperCase();
  }, [gameId, initialRoomCode]);
  const [activeControllers, setActiveControllers] = useState<string[]>([]);
  const lastEventTimestampRef = useRef<number>(Date.now());
  const [controllerOrigin, setControllerOrigin] = useState("https://magguru.web.id");
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  if (!supabaseRef.current && typeof window !== "undefined") {
    try {
      supabaseRef.current = createClient();
    } catch {
      // ignore
    }
  }

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

  // Combined class students + manually added students
  const combinedStudents = useMemo(() => {
    return [...classStudents, ...manualStudents];
  }, [classStudents, manualStudents]);

  // Team capacity per team (1 sampai 8 siswa per tim)
  const [teamCapacity, setTeamCapacity] = useState<number>(() => {
    const available = allStudents.length;
    if (available <= 0) return 4;
    const maxCap = Math.floor(available / 4);
    if (maxCap < 1) return 1;
    return Math.min(4, Math.max(1, maxCap));
  });

  const totalAvailable = combinedStudents.length;
  const requiredStudents = teamCapacity * 4;
  const maxPossiblePerTeam = Math.floor(totalAvailable / 4);
  const isInsufficient = totalAvailable < requiredStudents;

  // Distribute students across 4 teams based on teamCapacity
  const distributeStudents = useCallback(
    (cap = teamCapacity) => {
      const pool = [...combinedStudents].sort(() => Math.random() - 0.5);
      setTeams((prev) => {
        return prev.map((t, teamIdx) => {
          const start = teamIdx * cap;
          const end = start + cap;
          const assignedMembers = pool.slice(start, end);
          return {
            ...t,
            members: assignedMembers,
            currentMemberIndex: 0,
          };
        });
      });
      playSfx("correct");
    },
    [combinedStudents, teamCapacity],
  );

  const handleSelectCapacity = useCallback(
    (cap: number) => {
      setTeamCapacity(cap);
      distributeStudents(cap);
    },
    [distributeStudents],
  );

  useEffect(() => {
    if (combinedStudents.length > 0) {
      distributeStudents(teamCapacity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, combinedStudents.length]);

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

  // Supabase Realtime Broadcast Listener (Instant <40ms WebSocket sync)
  useEffect(() => {
    if (!roomCode) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;

    const channelName = `magguru_room_ctrl_${roomCode.toUpperCase()}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "controller_press" }, ({ payload }) => {
        if (!payload) return;
        const { teamId, optionKey } = payload;
        if (teamId && optionKey && phase === "question") {
          handleRecordAnswer(teamId, optionKey);
        }
      })
      .on("broadcast", { event: "controller_heartbeat" }, ({ payload }) => {
        if (payload?.teamId) {
          setActiveControllers((prev) => Array.from(new Set([...prev, payload.teamId])));
        }
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [roomCode, phase, handleRecordAnswer]);

  // Same-origin BroadcastChannel (Instant 0ms sync for multi-tab testing)
  useEffect(() => {
    if (!roomCode || typeof window === "undefined" || !("BroadcastChannel" in window)) return;

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`magguru_bc_${roomCode.toUpperCase()}`);
      bc.onmessage = (ev) => {
        if (ev.data?.event === "controller_press" && ev.data?.payload) {
          const { teamId, optionKey } = ev.data.payload;
          if (teamId && optionKey && phase === "question") {
            handleRecordAnswer(teamId, optionKey);
          }
        } else if (ev.data?.event === "controller_heartbeat" && ev.data?.payload?.teamId) {
          const tId = ev.data.payload.teamId;
          setActiveControllers((prev) => Array.from(new Set([...prev, tId])));
        }
      };
    } catch {
      // ignore
    }

    return () => {
      try {
        bc?.close();
      } catch {
        // ignore
      }
    };
  }, [roomCode, phase, handleRecordAnswer]);

  // Continuously synchronize projector state with controller API & Realtime channels
  useEffect(() => {
    const answeredTeamsObj: Record<string, { optionKey: string; timestamp: number }> = {};
    for (const [tId, rec] of Object.entries(answers)) {
      answeredTeamsObj[tId] = { optionKey: rec.optionKey, timestamp: rec.answeredAt };
    }

    const syncPayload = {
      phase: gameStarted ? phase : "lobby",
      currentQuestionIndex,
      timerSeconds,
      totalQuestions,
      questionText: activeQuestion.question_text,
      answeredTeams: answeredTeamsObj,
    };

    // 1. Supabase Realtime Broadcast
    try {
      const supabase = supabaseRef.current;
      if (supabase && roomCode) {
        const channelName = `magguru_room_ctrl_${roomCode.toUpperCase()}`;
        const channel = supabase.channel(channelName);
        void channel.send({
          type: "broadcast",
          event: "projector_sync",
          payload: syncPayload,
        });
      }
    } catch {
      // ignore
    }

    // 2. Browser BroadcastChannel
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window && roomCode) {
        const bc = new BroadcastChannel(`magguru_bc_${roomCode.toUpperCase()}`);
        bc.postMessage({
          event: "projector_sync",
          payload: syncPayload,
        });
        bc.close();
      }
    } catch {
      // ignore
    }

    // 3. HTTP REST sync
    void fetch("/api/projector/controller", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomCode,
        action: "sync_state",
        ...syncPayload,
      }),
    }).catch(() => {});
  }, [gameStarted, phase, currentQuestionIndex, timerSeconds, totalQuestions, activeQuestion.question_text, answers, roomCode]);

  // Wireless Phone Controller Poller
  useEffect(() => {
    if (phase === "finished") return;

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
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between game-screen font-arabic">
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
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between game-screen font-arabic">
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

  if (activeEngine === "space") {
    return (
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between game-screen font-arabic">
        <header className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <div>
              <h2 className="text-base font-black text-white">Penjaga Antariksa (Space Defender 60 FPS)</h2>
              <p className="text-xs text-cyan-400">{gameName}</p>
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
        <SpaceDefenderPlayer questions={questions} onFinish={() => setPhase("finished")} isRtl={isRtl} />
      </main>
    );
  }

  if (activeEngine === "memory") {
    return (
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between game-screen font-arabic">
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
      <main className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between game-screen font-arabic">
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
      <main className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 md:p-8 select-none relative overflow-hidden font-sans game-screen font-arabic">
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
                onClick={() => setActiveEngine("space")}
                className="px-2 py-1 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/60 text-cyan-200 border border-cyan-400/40 text-xs font-bold transition flex items-center gap-1"
              >
                <span>🚀</span>
                <span>Antariksa</span>
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
              Buka di HP Siswa:{" "}
              <span className="text-emerald-400 underline font-mono select-all">
                {controllerOrigin}/controller?room={roomCode}
              </span>
            </h2>

            {/* Visual indicators for 4 team controllers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 max-w-2xl mx-auto">
              {teams.map((t) => {
                const isStickConnected = activeControllers.includes(t.id);
                return (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-2xl border text-center transition-all ${
                      isStickConnected
                        ? "bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/20"
                        : "bg-black/40 border-white/10 text-slate-400 opacity-60"
                    }`}
                  >
                    <div className="text-xs font-black">{t.name}</div>
                    <div className="text-[10px] font-mono mt-1 font-bold">
                      {isStickConnected ? "🟢 STIK TERHUBUNG" : "⚪ MENUNGGU HP"}
                    </div>
                  </div>
                );
              })}
            </div>

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

          {/* Pilihan Jumlah Siswa per Tim (1 sampai 8) */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-white/10 shadow-xl backdrop-blur space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">👥</span>
                  <h3 className="text-sm font-black text-white">
                    Pilih Jumlah Siswa per Tim (4 Tim Arena):
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-400/30">
                    Pilihan: 1 - 8 Siswa / Tim
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tentukan berapa murid yang mengisi masing-masing dari 4 tim (Merah, Biru, Kuning, Hijau).
                </p>
              </div>

              <div className="text-xs text-slate-300 bg-black/50 px-3 py-1.5 rounded-xl border border-white/10 self-start sm:self-auto flex items-center gap-2">
                <span>Total Siswa Tersedia:</span>
                <strong className="text-emerald-400 font-mono text-sm">{totalAvailable}</strong>
                <span>Orang</span>
              </div>
            </div>

            {/* 8 Options for 1 to 8 students per team */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((cap) => {
                const isSelected = teamCapacity === cap;
                const needed = cap * 4;
                const isEnough = totalAvailable >= needed;
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => handleSelectCapacity(cap)}
                    className={`py-2 px-1 rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-0.5 border-2 ${
                      isSelected
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 border-emerald-300 shadow-lg shadow-emerald-500/20 scale-105 font-black"
                        : isEnough
                          ? "bg-slate-800/90 hover:bg-slate-700 text-white border-white/10 hover:border-white/20"
                          : "bg-amber-950/40 hover:bg-amber-900/50 text-amber-200 border-amber-500/40"
                    }`}
                  >
                    <span className="text-xs font-black">{cap} Siswa</span>
                    <span
                      className={`text-[10px] font-mono leading-none ${
                        isSelected ? "text-slate-950 font-bold" : isEnough ? "text-slate-400" : "text-amber-400 font-bold"
                      }`}
                    >
                      {needed} Murid
                    </span>
                    {!isEnough && !isSelected && (
                      <span className="text-[9px] text-amber-400 leading-none font-bold">⚠️ Kurang</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Warning Banner if Insufficient / Success Info if Enough */}
          {isInsufficient ? (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-yellow-950/90 border-2 border-amber-400 shadow-2xl backdrop-blur text-left">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl shrink-0 animate-bounce">⚠️</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-amber-300">
                        Jumlah Murid Belum Cukup untuk Pembagian Tim!
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 text-[10px] font-bold border border-amber-400/40">
                        Peringatan
                      </span>
                    </div>
                    <p className="text-xs text-amber-100/90 leading-relaxed mt-1">
                      Anda memilih <strong>{teamCapacity} siswa per tim</strong> (membutuhkan total <strong>{requiredStudents} murid</strong> untuk 4 tim),
                      sedangkan murid di kelas ini hanya ada <strong>{totalAvailable} orang</strong>
                      {maxPossiblePerTeam >= 1 ? (
                        <span> (hanya cukup dibagi <strong>{maxPossiblePerTeam} murid per tim</strong>).</span>
                      ) : (
                        <span> (belum cukup untuk 1 murid per tim, butuh minimal 4 murid).</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                  {maxPossiblePerTeam >= 1 && (
                    <button
                      type="button"
                      onClick={() => handleSelectCapacity(Math.min(8, Math.max(1, maxPossiblePerTeam)))}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs transition shadow-lg flex items-center gap-1.5"
                    >
                      <span>⚡</span>
                      <span>Sesuaikan Otomatis ke {maxPossiblePerTeam} Murid/Tim</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowClassModal(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition border border-white/20 flex items-center gap-1.5"
                  >
                    <span>+</span>
                    <span>Tambah Murid Manual</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-base">✅</span>
                <span>
                  <strong>Pembagian Tim Ideal:</strong> 4 Tim masing-masing diisi <strong>{teamCapacity} siswa</strong> (Total {requiredStudents} siswa bertanding).
                  {totalAvailable > requiredStudents && (
                    <span className="text-emerald-300/80"> ({totalAvailable - requiredStudents} siswa lainnya sebagai pemain cadangan/bergantian).</span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => distributeStudents(teamCapacity)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-[11px] font-bold border border-emerald-400/30 transition flex items-center gap-1"
              >
                <span>🎲</span>
                <span>Acak Ulang Posisi</span>
              </button>
            </div>
          )}

          {/* 4 Teams Podiums */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {teams.map((t) => {
              const isShort = t.members.length < teamCapacity;
              return (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border ${t.cardBg} ${t.accentBorder} shadow-lg flex flex-col justify-between min-h-[160px]`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${t.badgeBg}`} />
                        <span className="font-black text-sm text-white">{t.name}</span>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                          isShort
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {t.members.length} / {teamCapacity} Siswa
                      </span>
                    </div>

                    {isShort && (
                      <div className="mt-1 text-[10px] text-amber-300 font-semibold">
                        Kurang {teamCapacity - t.members.length} murid
                      </div>
                    )}

                    <div className="my-2 max-h-28 overflow-y-auto text-xs space-y-1 text-slate-300 pr-1">
                      {t.members.length > 0 ? (
                        t.members.map((m, mIdx) => (
                          <div key={m.id || mIdx} className="truncate bg-black/30 px-2 py-1 rounded flex items-center justify-between">
                            <span className="truncate">• {m.name}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">#{mIdx + 1}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-500 italic text-[11px] block py-2">
                          Belum ada murid di tim ini
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetTeamId(t.id);
                      setShowClassModal(true);
                    }}
                    className="w-full mt-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition text-center"
                  >
                    + Tambah Siswa
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => distributeStudents(teamCapacity)}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition flex items-center gap-2"
            >
              <span>🎲</span>
              <span>Acak Siswa Kelas ({totalAvailable})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isInsufficient) {
                  playSfx("wrong");
                  setShowInsufficientModal(true);
                  return;
                }
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

        {/* Modal: Peringatan Pembagian Tim Kurang */}
        {showInsufficientModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-5 shadow-2xl text-left">
              <div className="flex items-start gap-4">
                <span className="text-4xl p-3 bg-amber-500/20 border border-amber-400/40 rounded-2xl shrink-0">
                  ⚠️
                </span>
                <div>
                  <h3 className="text-xl font-black text-white">
                    Peringatan Pembagian Tim
                  </h3>
                  <p className="text-xs text-amber-300 font-bold uppercase tracking-wider mt-0.5">
                    Jumlah Murid Tidak Mencukupi
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-xs text-slate-300 space-y-2 leading-relaxed">
                <p>
                  Anda memilih <strong>{teamCapacity} siswa per tim</strong>, yang membutuhkan total{" "}
                  <strong className="text-amber-300">{requiredStudents} murid</strong> untuk mengisi 4 tim arena secara seimbang.
                </p>
                <p>
                  Sedangkan murid yang tersedia saat ini baru{" "}
                  <strong className="text-amber-300">{totalAvailable} murid</strong>
                  {maxPossiblePerTeam >= 1 ? (
                    <span> (hanya cukup dibagi rata <strong>{maxPossiblePerTeam} murid per tim</strong>).</span>
                  ) : (
                    <span> (belum cukup untuk 1 murid per tim).</span>
                  )}
                </p>
                <p className="text-slate-400 text-[11px]">
                  Jika dimulai sekarang, beberapa tim tidak akan memiliki jumlah anggota yang seimbang dalam menjawab soal.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {maxPossiblePerTeam >= 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newCap = Math.min(8, Math.max(1, maxPossiblePerTeam));
                      setTeamCapacity(newCap);
                      distributeStudents(newCap);
                      setShowInsufficientModal(false);
                      setGameStarted(true);
                      playSfx("boost");
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <span>⚡</span>
                    <span>Sesuaikan ke {maxPossiblePerTeam} Siswa & Langsung Mulai</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowInsufficientModal(false);
                    setGameStarted(true);
                    playSfx("boost");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition border border-white/10"
                >
                  ▶️ Tetap Mulai Dengan Anggota Seadanya
                </button>

                <button
                  type="button"
                  onClick={() => setShowInsufficientModal(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Kembali & Atur Ulang Pilihan Tim
                </button>
              </div>
            </div>
          </div>
        )}

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
                    const manualStudent: StudentMember = {
                      id: `manual-${Date.now()}`,
                      name: newStudentName.trim(),
                      class_id: selectedClassId,
                    };
                    setManualStudents((prev) => [...prev, manualStudent]);
                    setTeams((prev) =>
                      prev.map((t) =>
                        t.id === targetTeamId
                          ? {
                              ...t,
                              members: [...t.members, manualStudent],
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
    <main className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-3 md:p-6 select-none relative overflow-hidden font-sans game-screen font-arabic">
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
          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-wide leading-[1.6] py-2 drop-shadow-md select-text"
            style={{ fontFamily: "'Traditional Arabic', var(--font-amiri), Amiri, serif" }}
            dir="auto"
          >
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
            const optText = rawOpt?.option_text || `(Pilihan ${spec.key})`;
            const textLen = optText.length;
            const optFontClass =
              textLen > 45
                ? "text-base sm:text-lg md:text-xl leading-normal"
                : textLen > 25
                ? "text-lg sm:text-xl md:text-2xl leading-normal"
                : "text-xl md:text-2xl lg:text-3xl leading-snug";

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
                <div
                  className={`font-black break-words ${optFontClass}`}
                  style={{ fontFamily: "'Traditional Arabic', var(--font-amiri), Amiri, Tahoma, sans-serif" }}
                  dir="auto"
                >
                  {optText}
                </div>
                {/* Anti-cheat: Only display which teams picked this after question reveal! */}
                {phase === "reveal" && teamsPickedThis.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/20 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold opacity-80">Dipilih:</span>
                    {teamsPickedThis.map((ans) => (
                      <span key={ans.teamId} className="px-2 py-0.5 rounded-lg bg-black/40 text-white font-black text-[11px]">
                        {teams.find((t) => t.id === ans.teamId)?.name} {ans.isCorrect ? "✓" : "✗"}
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
                      <span>✓ JAWABAN TERKUNCI</span>
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
