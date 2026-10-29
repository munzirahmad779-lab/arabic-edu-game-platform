"use client";

import { useEffect, useRef } from "react";

type QuestionDeadlineWatcherProps = {
  enabled: boolean;
  questionId: string;
  questionStartedAt: string | null;
  timeLimitSeconds: number;
  serverSkewMs: number;
  onTimeout: () => void;
};

export function QuestionDeadlineWatcher({
  enabled,
  questionId,
  questionStartedAt,
  timeLimitSeconds,
  serverSkewMs,
  onTimeout,
}: QuestionDeadlineWatcherProps) {
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled || !questionStartedAt) return;

    const startedMs = new Date(questionStartedAt).getTime();
    if (!Number.isFinite(startedMs)) return;

    const deadlineMs = startedMs + timeLimitSeconds * 1000;
    const delayMs = deadlineMs - (Date.now() + serverSkewMs);
    if (delayMs <= 0) {
      onTimeoutRef.current();
      return;
    }

    const timer = window.setTimeout(() => onTimeoutRef.current(), delayMs + 50);
    return () => window.clearTimeout(timer);
  }, [
    enabled,
    questionId,
    questionStartedAt,
    serverSkewMs,
    timeLimitSeconds,
  ]);

  return null;
}
