"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameShell } from "@/components/game-engine/game-shell";
import type {
  ConsequenceType,
  NormalizedGameType,
} from "@/lib/game-engine/types";

type Feedback = {
  isVisible: boolean;
  isCorrect: boolean;
  consequence: ConsequenceType;
  scoreAwarded?: number;
  streak?: number;
  message?: string;
  correctAnswerText?: string;
};

type RoomTimerShellProps = {
  gameName: string;
  gameType: NormalizedGameType;
  gameMode: string;
  questionIndex: number;
  questionCount: number;
  currentScore?: number;
  rank?: number;
  totalParticipants?: number;
  streak?: number;
  comboMultiplier?: number;
  timeLimitSeconds?: number;
  isCooperative?: boolean;
  isRtl?: boolean;
  submitError?: string | null;
  feedback?: Feedback;
  roomState: "waiting" | "running" | "ended" | "locked";
  questionStartedAt: string | null;
  serverTime: string;
  children: ReactNode;
};

export function RoomTimerShell({
  roomState,
  questionStartedAt,
  serverTime,
  timeLimitSeconds = 20,
  isCooperative = false,
  children,
  ...shellProps
}: RoomTimerShellProps) {
  const [now, setNow] = useState(() => Date.now());
  const skewRef = useRef(0);

  useEffect(() => {
    const serverMs = new Date(serverTime).getTime();
    if (Number.isFinite(serverMs)) {
      skewRef.current = serverMs - Date.now();
    }
  }, [serverTime]);

  useEffect(() => {
    if (roomState !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [roomState]);

  const adjustedNow = now + skewRef.current;

  let countdown: number | null = null;
  if (roomState === "running" && questionStartedAt) {
    const remainingMs = new Date(questionStartedAt).getTime() - adjustedNow;
    countdown = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  let answerSecondsLeft: number | null = null;
  if (!isCooperative && roomState === "running" && questionStartedAt && countdown === 0) {
    const deadline =
      new Date(questionStartedAt).getTime() + timeLimitSeconds * 1000;
    answerSecondsLeft = Math.max(0, Math.ceil((deadline - adjustedNow) / 1000));
  }

  return (
    <GameShell
      {...shellProps}
      timeLimitSeconds={timeLimitSeconds}
      isCooperative={isCooperative}
      secondsLeft={answerSecondsLeft}
      countdown={countdown}
    >
      {children}
    </GameShell>
  );
}
