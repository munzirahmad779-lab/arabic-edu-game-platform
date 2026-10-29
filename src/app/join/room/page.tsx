"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { resumeBackgroundAudio } from "@/lib/bg-audio-events";
import { RoomTimerShell } from "./room-timer-shell";
import { QuestionDeadlineWatcher } from "./question-deadline-watcher";
import { GameRegistry } from "@/lib/game-engine/registry";
import { resolveEffectiveQuestionDurationSeconds } from "@/lib/game-engine/question-duration";

import { QuizPlayer } from "@/components/game-players/quiz-player";
import type {
  ScoreEvent,
  GameSessionContext,
  ConsequenceType,
  GameMode,
  AnswerResult,
} from "@/lib/game-engine/types";
import idDict from "@/lib/i18n/id.json";


import {
  DEFAULT_LOCALE,
  getDictionary,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";

const Confetti = dynamic(
  () => import("@/components/confetti").then((mod) => mod.Confetti),
  { ssr: false },
);
const RoomReview = dynamic(
  () => import("./room-review").then((mod) => mod.RoomReview),
  { ssr: false },
);

type Dict = Pick<
  typeof idDict,
  "join" | "reports" | "anagram" | "matching"
>;






function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  const v = m ? decodeURIComponent(m[1]) : DEFAULT_LOCALE;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

type Option = {
  id: string;
  option_key: string;
  option_text: string;
};

type Media = {
  id: string;
  media_type: "image" | "audio" | "video" | string;
  public_url: string;
  mime_type?: string;
  max_play_count?: number | null;
};

type Question = {
  id: string;
  position: number;
  question_text: string;
  difficulty: string;
  explanation_timing: string;
  time_limit_seconds?: number;
  options: Option[];
  media?: Media[];
  correct_option_key?: string;
};

type Session = {
  room_id: string;
  room_code: string;
  game_name: string;
  game_type?: string;
  game_mode: string;
  game_duration_seconds: number;
  question_duration_seconds?: number | null;
  started_at: string | null;
  room_state: "waiting" | "running" | "ended" | "locked";
  participant_id: string;
  participant_name: string;
  participant_count: number;
  capacity: number;
  question_index: number;
  question_count: number;
  question_started_at: string | null;
  question: Question | null;
  answer_submitted: boolean;
  server_time: string;
};

type LeaderboardRow = {
  participant_id: string;
  participant_name: string;
  is_self: boolean;
  answered_count: number;
  correct_count: number;
  weighted_correct: number;
  weighted_total: number;
  avg_response_ms: number;
  final_score: number;
  rnk: number;
};

// Tema Opsi C: satu latar teal tua brand Magguru untuk SEMUA keadaan room
// siswa (teal-700 #1F4A4E → teal-600 #255759 → teal-500 #2F6D72).
const ROOM_BG = "bg-gradient-to-br from-teal-700 via-teal-600 to-teal-500";

const WAITING_SESSION_POLL_MS = 4000;
const RUNNING_SESSION_POLL_MS = 2300;
const LEADERBOARD_POLL_MS = 6500;
const HEARTBEAT_INTERVAL_MS = 20000;
const ENDED_SESSION_BACKOFF_MS = [5000, 10000, 15000] as const;

function getCountdownSeconds(
  session: Session | null,
  serverSkewMs: number,
): number | null {
  if (
    !session ||
    session.room_state !== "running" ||
    !session.question_started_at
  ) {
    return null;
  }
  const remainingMs =
    new Date(session.question_started_at).getTime() -
    (Date.now() + serverSkewMs);
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

function getAnswerSecondsLeft(
  session: Session | null,
  serverSkewMs: number,
): number | null {
  if (!session || session.game_mode === "cooperative") return null;
  if (getCountdownSeconds(session, serverSkewMs) !== 0) return null;
  if (!session.question_started_at) return null;
  const timeLimitSec = resolveEffectiveQuestionDurationSeconds(
    session.question?.difficulty,
    session.question_duration_seconds ?? session.question?.time_limit_seconds ?? null,
  );
  const deadline =
    new Date(session.question_started_at).getTime() + timeLimitSec * 1000;
  return Math.max(
    0,
    Math.ceil((deadline - (Date.now() + serverSkewMs)) / 1000),
  );
}

function getTotalSecondsLeft(
  session: Session | null,
  serverSkewMs: number,
): number | null {
  if (!session || session.game_mode !== "cooperative") return null;
  if (session.room_state !== "running" || !session.started_at) return null;
  const deadline =
    new Date(session.started_at).getTime() +
    session.game_duration_seconds * 1000;
  return Math.max(
    0,
    Math.ceil((deadline - (Date.now() + serverSkewMs)) / 1000),
  );
}

function sessionSignature(session: Session): string {
  return [
    session.room_state,
    session.question_index,
    session.question_count,
    session.participant_count,
    session.answer_submitted ? "1" : "0",
    session.question_started_at ?? "",
    session.started_at ?? "",
  ].join(":");
}

export default function JoinRoomPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  // Token aktif disimpan di ref: server dapat menyerahkan join_token baru
  // (new_join_token) lewat history.replaceState, tetapi prop searchParams
  // tidak berubah oleh replaceState — tanpa ref ini semua polling berikutnya
  // selamanya memakai token lama yang sudah tidak dikenal server.
  const activeTokenRef = useRef(token);
  useEffect(() => {
    if (token) activeTokenRef.current = token;
  }, [token]);

  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [dict, setDict] = useState<Dict>(idDict);
  useEffect(() => {
    const nextLocale = readLocale();
    setLocale(nextLocale);
    if (nextLocale !== DEFAULT_LOCALE) {
      void getDictionary(nextLocale).then((nextDict) => {
        setDict({
          join: nextDict.join,
          reports: nextDict.reports,
          anagram: nextDict.anagram,
          matching: nextDict.matching,
        });
      });
    }
  }, []);

  const t = dict.join;
  const isRtl = locale === "ar";

  const MODE_LABEL: Record<string, string> = {
    competitive: dict.reports.mode_competitive,
    cooperative: dict.reports.mode_cooperative,
    endless: dict.reports.mode_endless,
    practice: dict.reports.mode_practice,
    learning: dict.reports.mode_learning,
    anagram: dict.anagram.title,
    matching: dict.matching.title,
  };

  const [session, setSession] = useState<Session | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endedRoomCode, setEndedRoomCode] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [streak, setStreak] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [gameFeedback, setGameFeedback] = useState<{
    isVisible: boolean;
    isCorrect: boolean;
    consequence: ConsequenceType;
    scoreAwarded?: number;
    streak?: number;
    message?: string;
    correctAnswerText?: string;
  } | undefined>(undefined);

  const handleGameEvent = useCallback((event: ScoreEvent) => {
    setGameFeedback({
      isVisible: true,
      isCorrect: event.isCorrect,
      consequence: event.consequence,
      scoreAwarded: event.scoreAwarded,
      streak: event.streak,
      message: event.message,
    });
    if (event.isCorrect) {
      setStreak((s) => s + 1);
      setComboMultiplier((c) => Math.min(4, c + 1));
    } else {
      setStreak(0);
      setComboMultiplier(1);
    }
  }, []);

  const skewRef = useRef(0);
  const sessionInFlightRef = useRef(false);
  const leaderboardInFlightRef = useRef(false);
  const heartbeatInFlightRef = useRef(false);
  const nextSessionPollAtRef = useRef(0);
  const nextLeaderboardPollAtRef = useRef(0);
  const nextHeartbeatAtRef = useRef(0);
  const sessionSignatureRef = useRef("");
  const endedBackoffIndexRef = useRef(0);

  const roomStateRef = useRef<Session["room_state"] | undefined>(undefined);
  const transitioningUntilRef = useRef(0);

  useEffect(() => {
    roomStateRef.current = session?.room_state;
  }, [session?.room_state]);

  const loadSession = useCallback(async (
    force = false,
  ): Promise<Session | null> => {
    const activeToken = activeTokenRef.current;
    if (!activeToken) {
      setLoadError(t.room_err_invalid_token);
      return null;
    }
    if (!force && Date.now() < transitioningUntilRef.current) {
      return null;
    }
    if (sessionInFlightRef.current) return null;
    sessionInFlightRef.current = true;
    try {
      let codeParam = "";
      let nameParam = "";
      if (typeof window !== "undefined") {
        try {
          codeParam = localStorage.getItem("magguru_last_room_code") || "";
          nameParam = localStorage.getItem("magguru_last_student_name") || "";
        } catch {}
      }

      const queryUrl = `/api/rooms/session?token=${encodeURIComponent(activeToken)}${
        codeParam ? `&code=${encodeURIComponent(codeParam)}` : ""
      }${nameParam ? `&name=${encodeURIComponent(nameParam)}` : ""}`;

      const res = await fetch(queryUrl);
      const raw = await res.json();

      if (!res.ok || raw.error) {
        // 404 + flag ended, ATAU 404 sementara kode room tersimpan masih ada:
        // masuk mode "sesi ditutup" yang polling-nya dapat menyambungkan
        // kembali lewat kode+namo, bukan layar error mati.
        if (
          res.status === 404 &&
          (raw.ended === true || codeParam !== "")
        ) {
          if (raw.room_code) setEndedRoomCode(raw.room_code);
          else if (codeParam) setEndedRoomCode(codeParam);
          setSessionEnded(true);
          return null;
        }
        setLoadError(`${t.room_err_load} (${raw.error || "Gagal memuat status"})`);
        return null;
      }

      if (raw.new_join_token) {
        activeTokenRef.current = raw.new_join_token;
        if (typeof window !== "undefined") {
          try {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("token", raw.new_join_token);
            window.history.replaceState({}, "", newUrl.toString());
          } catch {}
        }
      }

      setSessionEnded(false);
      const incoming: Session = {
        ...raw,
        room_state: raw.room_state as Session["room_state"],
        participant_name: raw.participant_name ?? "",
        question: raw.question as Question | null,
      };
      const serverMs = new Date(incoming.server_time).getTime();
      if (Number.isFinite(serverMs)) {
        skewRef.current = serverMs - Date.now();
      }

      setSession(incoming);
      setLoadError("");
      if (incoming.room_code && typeof window !== "undefined") {
        try {
          localStorage.setItem("magguru_last_room_code", incoming.room_code);
          if (incoming.participant_name) {
            localStorage.setItem("magguru_last_student_name", incoming.participant_name);
          }
        } catch {}
      }
      return incoming;
    } catch {
      setLoadError(t.room_err_connect);
      return null;
    } finally {
      sessionInFlightRef.current = false;
    }
  }, [t]);

  const loadLeaderboard = useCallback(async () => {
    if (!activeTokenRef.current || leaderboardInFlightRef.current) return;
    leaderboardInFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/rooms/leaderboard?token=${encodeURIComponent(activeTokenRef.current)}`,
      );
      if (res.ok) {
        const data: unknown = await res.json();
        if (Array.isArray(data)) {
          setLeaderboard(data as LeaderboardRow[]);
        }
      }
    } catch {
      // ignore
    } finally {
      leaderboardInFlightRef.current = false;
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!activeTokenRef.current || heartbeatInFlightRef.current) return;
    heartbeatInFlightRef.current = true;
    try {
      await fetch("/api/rooms/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinToken: activeTokenRef.current }),
      });
    } catch {
      // ignore
    } finally {
      heartbeatInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const delayForState = (
      state: Session["room_state"] | undefined,
      closed: boolean,
    ): number => {
      if (closed || state === "ended") {
        const index = Math.min(
          endedBackoffIndexRef.current,
          ENDED_SESSION_BACKOFF_MS.length - 1,
        );
        const delay = ENDED_SESSION_BACKOFF_MS[index];
        endedBackoffIndexRef.current = Math.min(
          index + 1,
          ENDED_SESSION_BACKOFF_MS.length - 1,
        );
        return delay;
      }
      endedBackoffIndexRef.current = 0;
      return state === "running"
        ? RUNNING_SESSION_POLL_MS
        : WAITING_SESSION_POLL_MS;
    };

    const refreshLeaderboard = async (
      incoming: Session,
      force = false,
    ): Promise<void> => {
      if (incoming.room_state !== "running" && incoming.room_state !== "ended") {
        return;
      }
      const signature = sessionSignature(incoming);
      const changed = signature !== sessionSignatureRef.current;
      sessionSignatureRef.current = signature;
      if (
        force ||
        changed ||
        Date.now() >= nextLeaderboardPollAtRef.current
      ) {
        nextLeaderboardPollAtRef.current = Date.now() + LEADERBOARD_POLL_MS;
        await loadLeaderboard();
      }
    };

    const pollSession = async (force = false): Promise<void> => {
      const previousState = roomStateRef.current;
      const incoming = await loadSession(force);
      if (cancelled || !incoming) return;

      await refreshLeaderboard(incoming);
      if (incoming.room_state !== previousState) {
        nextSessionPollAtRef.current =
          Date.now() + delayForState(incoming.room_state, false);
      }
    };

    const startHeartbeat = (): void => {
      nextHeartbeatAtRef.current = Date.now() + HEARTBEAT_INTERVAL_MS;
      void sendHeartbeat();
    };

    nextSessionPollAtRef.current =
      Date.now() + delayForState(roomStateRef.current, sessionEnded);
    nextLeaderboardPollAtRef.current = 0;
    void pollSession(true);
    if (!sessionEnded && roomStateRef.current !== "ended") {
      startHeartbeat();
    }

    const timer = window.setInterval(() => {
      if (cancelled || document.visibilityState === "hidden") return;
      const nowTs = Date.now();
      const state = roomStateRef.current;

      if (
        !sessionEnded &&
        state !== "ended" &&
        nowTs >= nextHeartbeatAtRef.current
      ) {
        startHeartbeat();
      }

      if (nowTs >= nextSessionPollAtRef.current) {
        nextSessionPollAtRef.current =
          nowTs + delayForState(state, sessionEnded);
        void pollSession(sessionEnded || state === "ended");
        return;
      }

      if (
        (state === "running" || state === "ended") &&
        nowTs >= nextLeaderboardPollAtRef.current
      ) {
        nextLeaderboardPollAtRef.current = nowTs + LEADERBOARD_POLL_MS;
        void loadLeaderboard();
      }
    }, 250);

    const handleVisibilityChange = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      const state = roomStateRef.current;
      nextSessionPollAtRef.current =
        Date.now() + delayForState(state, sessionEnded);
      if (state === "running" || state === "ended") {
        nextLeaderboardPollAtRef.current = Date.now() + LEADERBOARD_POLL_MS;
      }
      void pollSession(true);
      if (!sessionEnded && state !== "ended") {
        startHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [loadSession, loadLeaderboard, sendHeartbeat, sessionEnded, token]);

  useEffect(() => {
    setSubmitError("");
    setGameFeedback(undefined);
  }, [session?.question?.id]);

  useEffect(() => {
    return () => {
      resumeBackgroundAudio();
    };
  }, [session?.question?.id]);

  useEffect(() => {
    return () => {
      resumeBackgroundAudio();
    };
  }, []);

  const isCooperative = session?.game_mode === "cooperative";
  const timeLimitSec = resolveEffectiveQuestionDurationSeconds(
    session?.question?.difficulty,
    session?.question_duration_seconds ?? session?.question?.time_limit_seconds ?? null,
  );

  /**
   * Submit jawaban ke server.
   * Mendukung 2 tipe:
   * - Option-based (quiz biasa): p_selected_option_id diisi, p_answer_text null
   * - Text-based (anagram): p_answer_text diisi, p_selected_option_id optional
   */
  const submitAnswer = useCallback(async (payload: {
    questionId: string;
    selectedOptionId: string | null;
    answerText: string | null;
  }): Promise<AnswerResult> => {
    const countdown = getCountdownSeconds(session, skewRef.current);
    const totalSecondsLeft = getTotalSecondsLeft(session, skewRef.current);
    const answerSecondsLeft = getAnswerSecondsLeft(session, skewRef.current);
    if (
      !session ||
      submitting ||
      session.room_state !== "running" ||
      (countdown !== null && countdown !== 0) ||
      (totalSecondsLeft !== null && totalSecondsLeft === 0) ||
      (!isCooperative && answerSecondsLeft === 0 && payload.selectedOptionId !== null)
    ) {
      return { accepted: false, isCorrect: false };
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/rooms/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinToken: activeTokenRef.current,
          questionId: payload.questionId,
          selectedOptionId: payload.selectedOptionId,
          answerText: payload.answerText,
        }),
      });

      const row = await res.json();

      if (!res.ok || row.error) {
        const msg = row.error || "";
        if (msg === "ALREADY_SUBMITTED") {
          setSubmitError(t.room_err_already);
        } else if (msg === "QUESTION_TIMEOUT") {
          setSubmitError(t.room_err_q_timeout);
        } else if (msg === "GAME_TIMEOUT") {
          setSubmitError(t.room_err_game_timeout);
        } else if (msg === "QUESTION_NOT_STARTED") {
          setSubmitError(t.room_err_not_started);
        } else {
          setSubmitError(t.room_err_submit);
        }
        return { accepted: false, isCorrect: false };
      }

      // Delay briefly (~1.2s) so student sees instant feedback overlay before transitioning
      transitioningUntilRef.current = Date.now() + 1200;
      setTimeout(() => {
        transitioningUntilRef.current = 0;
        void loadSession(true);
        void loadLeaderboard();
      }, 1200);

      return {
        accepted: row?.accepted ?? true,
        isCorrect: row?.is_correct ?? false,
        scoreAwarded: row?.score_awarded ?? 0,
      };
    } catch {
      setSubmitError(t.room_err_connect);
      return { accepted: false, isCorrect: false };
    } finally {
      setSubmitting(false);
    }
  }, [
    session,
    submitting,
    isCooperative,
    t,
    loadSession,
    loadLeaderboard,
  ]);

  // Auto-handle timeout so student is NEVER stuck on any question.
  const timeoutHandledRef = useRef<string | null>(null);
  const handleQuestionTimeout = useCallback(() => {
    if (
      !session ||
      session.room_state !== "running" ||
      !session.question ||
      session.answer_submitted ||
      submitting ||
      timeoutHandledRef.current === session.question.id
    ) {
      return;
    }
    timeoutHandledRef.current = session.question.id;
    void submitAnswer({
      questionId: session.question.id,
      selectedOptionId: null,
      answerText: null,
    });
  }, [session, submitAnswer, submitting]);

  if (!token) {
    return (
      <main
        className={`min-h-screen ${ROOM_BG} p-4 text-white`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur">
          {t.error_invalid}
        </div>
      </main>
    );
  }

  if (sessionEnded) {
    let effectiveCode = endedRoomCode;
    let effectiveName = "";
    if (typeof window !== "undefined") {
      try {
        if (!effectiveCode) effectiveCode = localStorage.getItem("magguru_last_room_code");
        effectiveName = localStorage.getItem("magguru_last_student_name") || "";
      } catch {}
    }
    const returnJoinUrl = effectiveCode
      ? `/join?code=${encodeURIComponent(effectiveCode)}${effectiveName ? `&name=${encodeURIComponent(effectiveName)}` : ""}`
      : "/join";
    return (
      <main
        className={`min-h-screen ${ROOM_BG} p-4 text-white flex flex-col justify-center items-center`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-md w-full py-12 text-center">
          <div className="rounded-[2.5rem] bg-white/10 border border-white/15 p-8 shadow-2xl backdrop-blur">
            <div className="text-6xl animate-bounce">🔁</div>
            <h1 className="mt-5 text-2xl font-black text-white">
              {t.room_session_closed_title}
            </h1>
            <p className="mt-3 text-sm text-teal-100 leading-relaxed">
              {t.room_session_closed_desc}
            </p>
            {effectiveCode && (
              <div className="mt-4 inline-block rounded-xl bg-terracotta-500/15 border border-terracotta-500/40 px-3.5 py-1.5 text-xs font-mono font-bold text-terracotta-100">
                Kode Ruangan: {effectiveCode}
              </div>
            )}
            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setSessionEnded(false);
                  void loadSession(true);
                }}
                className="w-full inline-flex justify-center items-center rounded-2xl bg-terracotta-500 py-3.5 px-6 font-black text-white shadow-xl transition active:scale-95 hover:bg-terracotta-600"
              >
                🔄 Periksa Ulang Ruangan
              </button>
              <Link
                href={returnJoinUrl}
                className="w-full inline-flex justify-center items-center rounded-2xl border border-white/25 bg-white/10 py-3 px-6 text-sm font-bold text-white transition hover:bg-white/20 active:scale-95"
              >
                🎮 {effectiveCode ? `Gabung ke Sesi Baru (${effectiveCode})` : t.room_back_join}
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main
        className={`min-h-screen ${ROOM_BG} p-4 text-white`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-2xl py-16 text-center">
          <div className="text-5xl">🎮</div>
          <h1 className="mt-4 text-2xl font-black text-white">{t.room_loading}</h1>
          {loadError ? (
            <>
              <p className="mt-3 text-sm text-white/80">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadSession()}
                className="mt-6 rounded-2xl bg-white px-6 py-3 font-black text-teal-700 shadow-lg transition hover:bg-teal-50"
              >
                {t.room_retry}
              </button>
            </>
          ) : null}
        </div>
      </main>
    );
  }

  if (
    session.room_state === "ended" ||
    (session.room_state === "running" &&
      session.question_count > 0 &&
      session.question_index >= session.question_count)
  ) {
    const me = leaderboard.find((r) => r.is_self);
    const podium = leaderboard.slice(0, 3);
    const onPodium = me ? me.rnk <= 3 : false;
    const highScore = me ? me.final_score >= 60 : false;
    const showConfetti = onPodium || highScore;
    const confettiCount = onPodium ? 170 : 90;
    const confettiOriginY = onPodium ? 0.95 : 1.05;

    return (
      <main
        className={`min-h-screen ${ROOM_BG} p-4 text-white`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {showConfetti ? (
          <Confetti
            particleCount={confettiCount}
            originY={confettiOriginY}
          />
        ) : null}

        <div className="relative mx-auto max-w-3xl space-y-6 py-8">
          <div className="rounded-[2rem] bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
            <div className="text-6xl">🏁</div>
            <h1 className="mt-4 text-3xl font-black text-white">{t.room_ended_title}</h1>
            <p className="mt-2 text-white/80">{session.game_name}</p>

            {me ? (
              <div className="mt-8 rounded-3xl bg-white p-6 text-slate-900 shadow-xl">
                <p className="text-xs font-bold text-slate-500">
                  {t.room_final_score}
                </p>
                <div className="mt-3 flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="text-5xl font-black tabular-nums text-teal-700">
                      {me.final_score}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      {t.room_of_100}
                    </div>
                  </div>
                  <div className="h-16 w-px bg-slate-200" />
                  <div className="text-center">
                    <div className="text-5xl font-black tabular-nums text-terracotta-600">
                      #{me.rnk}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      {t.room_rank_of_prefix} {leaderboard.length}
                    </div>
                  </div>
                </div>

                {onPodium ? (
                  <p className="mt-4 text-sm font-black text-teal-700">
                    {t.room_podium_congrats}
                  </p>
                ) : highScore ? (
                  <p className="mt-4 text-sm font-black text-terracotta-600">
                    {t.room_high_score}
                  </p>
                ) : null}

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-teal-50 p-3 text-center">
                    <div className="text-xs font-bold text-teal-600">
                      {t.room_correct_label}
                    </div>
                    <div className="mt-1 text-lg font-black text-teal-700">
                      {me.correct_count} / {session.question_count}
                    </div>
                  </div>
                  <div className="rounded-xl bg-terracotta-50 p-3 text-center">
                    <div className="text-xs font-bold text-terracotta-600">
                      {t.room_avg_speed_label}
                    </div>
                    <div className="mt-1 text-lg font-black text-terracotta-700">
                      {(me.avg_response_ms / 1000).toFixed(1)}{" "}
                      {t.room_seconds_suffix}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[2rem] bg-white/10 p-6 shadow-2xl backdrop-blur">
            <h2 className="text-lg font-black text-white">
              {t.room_leaderboard_title}
            </h2>

            {podium.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[podium[1], podium[0], podium[2]].map((row, i) => {
                  if (!row) return <div key={i} />;
                  const medal =
                    row.rnk === 1 ? "🥇" : row.rnk === 2 ? "🥈" : "🥉";
                  const height = row.rnk === 1 ? "pt-6" : "pt-3";
                  return (
                    <div key={row.participant_id} className={`${height}`}>
                      <div className="text-3xl">{medal}</div>
                      <div className="mt-1 truncate text-sm font-bold text-white">
                        {row.participant_name}
                      </div>
                      <div className="text-lg font-black tabular-nums text-white/90">
                        {row.final_score}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-6 max-h-96 overflow-auto rounded-2xl bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-start font-bold text-slate-600">
                      {t.room_th_rank}
                    </th>
                    <th className="px-3 py-2 text-start font-bold text-slate-600">
                      {t.room_th_name}
                    </th>
                    <th className="px-3 py-2 text-start font-bold text-slate-600">
                      {t.room_th_correct}
                    </th>
                    <th className="px-3 py-2 text-start font-bold text-slate-600">
                      {t.room_th_score}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={row.participant_id}
                      className={
                        row.is_self
                          ? "bg-terracotta-100 font-black text-terracotta-700"
                          : "border-t border-slate-100"
                      }
                    >
                      <td className="px-3 py-2 font-black">{row.rnk}</td>
                      <td className="px-3 py-2">
                        {row.participant_name}
                        {row.is_self ? (
                          <span className="ms-2 rounded-full bg-terracotta-500 px-2 py-0.5 text-[10px] font-black text-white">
                            {t.room_you_badge}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {row.correct_count} / {session.question_count}
                      </td>
                      <td className="px-3 py-2 font-mono font-black">
                        {row.final_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <RoomReview token={token} dict={dict} isRtl={isRtl} />
          <div className="text-center">
            <a
              href="/join"
              className="inline-flex rounded-2xl bg-white px-6 py-3 font-black text-teal-700 shadow-lg transition hover:bg-teal-50"
            >
              {t.room_exit_btn}
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (session.room_state === "locked") {
    return (
      <main
        className={`min-h-screen ${ROOM_BG} p-4 text-white`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-2xl py-12">
          <div className="rounded-[2rem] bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
            <div className="text-6xl">🔒</div>
            <h1 className="mt-4 text-3xl font-black text-white">
              {t.room_locked_title}
            </h1>
            <p className="mt-3 text-white/80">{t.room_locked_desc}</p>
          </div>
        </div>
      </main>
    );
  }

  if (session.room_state === "waiting") {
    return (
      <main
        className={`min-h-screen ${ROOM_BG} p-4 py-8 text-white`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[2rem] bg-white/10 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-teal-100">
                {t.room_label}
              </p>
              <span className="rounded-full bg-terracotta-500 px-2 py-0.5 text-xs font-black text-white">
                {MODE_LABEL[session.game_mode] ?? session.game_mode}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black text-white">{session.game_name}</h1>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <div className="text-xs font-bold text-slate-500">
                  {dict.join.code_label}
                </div>
                <div className="mt-2 text-xl font-black tracking-[0.12em]">
                  {session.room_code}
                </div>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <div className="text-xs font-bold text-slate-500">
                  {t.room_you_label}
                </div>
                <div className="mt-2 font-black">
                  {session.participant_name}
                </div>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <div className="text-xs font-bold text-slate-500">
                  {t.room_participants_label}
                </div>
                <div className="mt-2 text-2xl font-black">
                  {session.participant_count}
                </div>
              </div>
            </div>
            <div className="mt-8 rounded-3xl bg-white/95 p-8 text-center text-slate-900">
              <div className="text-5xl">⏳</div>
              <h2 className="mt-4 text-2xl font-black">
                {t.room_waiting_title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {t.room_waiting_desc}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const myRow = leaderboard.find((r) => r.is_self);
  const top3 = leaderboard.slice(0, 3);
  const gameType = GameRegistry.resolve(session.game_type, session.game_mode);

  const validGameModes: readonly GameMode[] = ["competitive", "cooperative", "endless", "practice", "learning"];
  const resolvedGameMode: GameMode = validGameModes.includes(session.game_mode as GameMode)
    ? (session.game_mode as GameMode)
    : "competitive";

  const gameSessionContext: GameSessionContext = {
    roomId: session.room_id,
    roomCode: session.room_code,
    gameName: session.game_name,
    gameType,
    gameMode: resolvedGameMode,
    durationSeconds: session.game_duration_seconds,
    participantId: session.participant_id,
    participantName: session.participant_name,
    questionIndex: session.question_index,
    questionCount: session.question_count,
    isRtl,
  };

  return (
    <>
      <QuestionDeadlineWatcher
        enabled={
          session.room_state === "running" &&
          !isCooperative &&
          !session.answer_submitted &&
          !submitting
        }
        questionId={session.question?.id ?? ""}
        questionStartedAt={session.question_started_at}
        timeLimitSeconds={timeLimitSec}
        serverSkewMs={skewRef.current}
        onTimeout={handleQuestionTimeout}
      />
      <RoomTimerShell
        gameName={session.game_name}
        gameType={gameType}
        gameMode={MODE_LABEL[session.game_mode] ?? session.game_mode}
        questionIndex={session.question_index}
        questionCount={session.question_count}
        currentScore={myRow?.final_score}
        rank={myRow?.rnk}
        totalParticipants={leaderboard.length}
        streak={streak}
        comboMultiplier={comboMultiplier}
        timeLimitSeconds={timeLimitSec}
        isCooperative={isCooperative}
        isRtl={isRtl}
        submitError={submitError}
        feedback={gameFeedback}
        roomState={session.room_state}
        questionStartedAt={session.question_started_at}
        serverTime={session.server_time}
      >
      {session.question ? (
        <QuizPlayer
          key={session.question.id}
          question={session.question}
          session={gameSessionContext}
          onSubmitAnswer={async (payload) => {
            return await submitAnswer({
              questionId: payload.questionId,
              selectedOptionId: payload.selectedOptionId,
              answerText: payload.answerText,
            });
          }}
          isRtl={isRtl}
          dict={dict}
          onGameEvent={handleGameEvent}
        />
      ) : (
        <div className="rounded-[2rem] bg-white/10 p-10 text-center shadow-2xl backdrop-blur">
          <h2 className="text-2xl font-black text-white">{t.room_preparing}</h2>
          {loadError ? (
            <p className="mt-3 text-sm text-white/80">{loadError}</p>
          ) : null}
        </div>
      )}

      {top3.length > 0 ? (
        <section className="mt-4 rounded-2xl bg-white/10 p-4 shadow-xl backdrop-blur">
          <p className="text-xs font-bold text-white/70">{t.room_top_now}</p>
          <div className="mt-2 space-y-1">
            {top3.map((row) => (
              <div
                key={row.participant_id}
                className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                  row.is_self ? "bg-white/20 font-black" : "bg-white/5"
                }`}
              >
                <span className="truncate">
                  #{row.rnk} {row.participant_name}
                  {row.is_self ? ` ${t.room_you_suffix}` : ""}
                </span>
                <span className="font-black tabular-nums">{row.final_score}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      </RoomTimerShell>
    </>
  );
}
