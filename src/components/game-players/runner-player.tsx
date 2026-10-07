"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuestionAdapter } from "@/lib/game-engine/question-adapters";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { GamePlayerProps, RawQuestion } from "@/lib/game-engine/types";

export function RunnerPlayer({
  question,
  onSubmitAnswer,
  isRtl,
  onGameEvent,
}: GamePlayerProps<RawQuestion>) {
  const runnerQuestion = useMemo(
    () => QuestionAdapter.toRunner(question),
    [question],
  );

  const laneCount = Math.max(2, runnerQuestion.lanes.length);
  const [activeLane, setActiveLane] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [characterState, setCharacterState] = useState<"running" | "boost" | "stumble">("running");
  const [submitting, setSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Canvas refs and animation states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerLaneRef = useRef(0);
  const targetLaneRef = useRef(0);
  const stateRef = useRef<"running" | "boost" | "stumble">("running");
  const speedRef = useRef(1);
  const scrollOffsetRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Sync refs with state
  useEffect(() => {
    targetLaneRef.current = activeLane;
  }, [activeLane]);

  useEffect(() => {
    stateRef.current = characterState;
    speedRef.current = characterState === "boost" ? 3 : characterState === "stumble" ? 0.3 : 1;
  }, [characterState]);

  const handleLaneCommit = useCallback(
    async (laneIndex: number) => {
      if (submitting || hasAnswered) return;
      const lane = runnerQuestion.lanes[laneIndex];
      if (!lane) return;

      setActiveLane(laneIndex);
      targetLaneRef.current = laneIndex;
      setSubmitting(true);
      setHasAnswered(true);
      playSfx("click");

      const result = await onSubmitAnswer({
        questionId: question.id,
        selectedOptionId: lane.optionId,
        answerText: null,
        responseTimeMs: 1500,
      });

      if (result.isCorrect) {
        setCharacterState("boost");
        playSfx("boost");
        onGameEvent?.({
          isCorrect: true,
          scoreAwarded: result.scoreAwarded ?? 100,
          comboMultiplier: 2,
          streak: 1,
          consequence: "boost",
          message: "SUPER DASH! Kecepatan Maksimal ⚡🚀",
        });
      } else {
        setCharacterState("stumble");
        playSfx("stumble");
        onGameEvent?.({
          isCorrect: false,
          scoreAwarded: 0,
          comboMultiplier: 1,
          streak: 0,
          consequence: "stumble",
          message: "Terpeleset Hambatan! Pelan sejenak ⚠️🏃",
        });
      }

      setSubmitting(false);
    },
    [submitting, hasAnswered, runnerQuestion.lanes, onSubmitAnswer, question.id, onGameEvent],
  );

  // Distance ticker
  useEffect(() => {
    const interval = window.setInterval(() => {
      setDistanceMeters((d) => d + (stateRef.current === "boost" ? 14 : stateRef.current === "stumble" ? 1 : 5));
    }, 150);
    return () => window.clearInterval(interval);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (submitting || hasAnswered) return;

      if (e.key === "ArrowLeft") {
        setActiveLane((prev) => {
          const next = isRtl ? Math.min(laneCount - 1, prev + 1) : Math.max(0, prev - 1);
          targetLaneRef.current = next;
          return next;
        });
      } else if (e.key === "ArrowRight") {
        setActiveLane((prev) => {
          const next = isRtl ? Math.max(0, prev - 1) : Math.min(laneCount - 1, prev + 1);
          targetLaneRef.current = next;
          return next;
        });
      } else if (e.key >= "1" && e.key <= String(laneCount)) {
        const idx = Number(e.key) - 1;
        if (idx < laneCount) {
          setActiveLane(idx);
          targetLaneRef.current = idx;
          void handleLaneCommit(idx);
        }
      } else if (e.key === "Enter" || e.key === " ") {
        void handleLaneCommit(targetLaneRef.current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [laneCount, isRtl, submitting, hasAnswered, handleLaneCommit]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchStartRef.current || submitting || hasAnswered) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
      // Horizontal swipe
      if (diffX > 0) {
        // Swipe Right
        setActiveLane((prev) => {
          const next = isRtl ? Math.max(0, prev - 1) : Math.min(laneCount - 1, prev + 1);
          targetLaneRef.current = next;
          return next;
        });
      } else {
        // Swipe Left
        setActiveLane((prev) => {
          const next = isRtl ? Math.min(laneCount - 1, prev + 1) : Math.max(0, prev - 1);
          targetLaneRef.current = next;
          return next;
        });
      }
    } else if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15) {
      // Tap on canvas to commit lane
      void handleLaneCommit(targetLaneRef.current);
    }
    touchStartRef.current = null;
  };

  // 60fps HTML5 Canvas Engine Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();
    let runCycle = 0;

    // Particles pool for boost/stumble effects
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      color: string;
      size: number;
    }> = [];

    function render(time: number) {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas?.clientWidth || 640;
      const height = canvas?.clientHeight || 320;

      if (canvas && (canvas.width !== width * dpr || canvas.height !== height * dpr)) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx?.save();
      ctx?.scale(dpr, dpr);

      // 1. Sky & Horizon
      const skyGrad = ctx?.createLinearGradient(0, 0, 0, height * 0.45);
      if (skyGrad && ctx) {
        skyGrad.addColorStop(0, "#090d16");
        skyGrad.addColorStop(0.6, "#0f172a");
        skyGrad.addColorStop(1, "#134e4a");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height * 0.45);
      }

      // Stars in sky
      if (ctx) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        for (let i = 1; i <= 20; i++) {
          const sx = (i * 97) % width;
          const sy = (i * 43) % (height * 0.35);
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      }

      // Parallax dunes & Minarets on Horizon
      const horizonY = height * 0.42;
      if (ctx) {
        ctx.fillStyle = "#064e3b";
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        ctx.quadraticCurveTo(width * 0.25, horizonY - 18, width * 0.5, horizonY);
        ctx.quadraticCurveTo(width * 0.75, horizonY - 24, width, horizonY);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fill();

        // Decorative Islamic Arch/Dome Silhouette in distance
        ctx.fillStyle = "rgba(4, 47, 46, 0.7)";
        const domeX = width * 0.5;
        ctx.beginPath();
        ctx.arc(domeX, horizonY - 10, 22, Math.PI, 0);
        ctx.rect(domeX - 22, horizonY - 10, 44, 12);
        ctx.fill();
      }

      // 2. Perspective Road / Running Track
      const roadTopWidth = width * 0.35;
      const roadBottomWidth = width * 0.96;
      const roadTopLeft = (width - roadTopWidth) / 2;
      const roadTopRight = roadTopLeft + roadTopWidth;
      const roadBottomLeft = (width - roadBottomWidth) / 2;
      const roadBottomRight = roadBottomLeft + roadBottomWidth;

      if (ctx) {
        const roadGrad = ctx.createLinearGradient(0, horizonY, 0, height);
        roadGrad.addColorStop(0, "#0f172a");
        roadGrad.addColorStop(0.3, "#042f2e");
        roadGrad.addColorStop(1, "#022c22");

        ctx.fillStyle = roadGrad;
        ctx.beginPath();
        ctx.moveTo(roadTopLeft, horizonY);
        ctx.lineTo(roadTopRight, horizonY);
        ctx.lineTo(roadBottomRight, height);
        ctx.lineTo(roadBottomLeft, height);
        ctx.closePath();
        ctx.fill();

        // Road Outer Curbs (Green/Gold Neon)
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#10b981";
        ctx.beginPath();
        ctx.moveTo(roadTopLeft, horizonY);
        ctx.lineTo(roadBottomLeft, height);
        ctx.moveTo(roadTopRight, horizonY);
        ctx.lineTo(roadBottomRight, height);
        ctx.stroke();
      }

      // Animated scrolling road segments
      scrollOffsetRef.current = (scrollOffsetRef.current + dt * 4 * speedRef.current) % 1;
      const numStripes = 8;
      if (ctx) {
        for (let s = 0; s < numStripes; s++) {
          const t = (s / numStripes + scrollOffsetRef.current / numStripes) % 1;
          const py = horizonY + (height - horizonY) * Math.pow(t, 2);
          const pWidthLeft = roadTopLeft + (roadBottomLeft - roadTopLeft) * t;
          const pWidthRight = roadTopRight + (roadBottomRight - roadTopRight) * t;

          ctx.strokeStyle = `rgba(52, 211, 153, ${0.15 + t * 0.25})`;
          ctx.lineWidth = 1 + t * 2;
          ctx.beginPath();
          ctx.moveTo(pWidthLeft, py);
          ctx.lineTo(pWidthRight, py);
          ctx.stroke();
        }

        // Lane Dividers
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
        for (let l = 1; l < laneCount; l++) {
          const ratio = l / laneCount;
          const topX = roadTopLeft + roadTopWidth * ratio;
          const bottomX = roadBottomLeft + roadBottomWidth * ratio;
          ctx.beginPath();
          ctx.moveTo(topX, horizonY);
          ctx.lineTo(bottomX, height);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // 3. Smooth Player Lane Interpolation
      const laneLerpSpeed = 12;
      playerLaneRef.current += (targetLaneRef.current - playerLaneRef.current) * dt * laneLerpSpeed;

      const playerLaneRatio = (playerLaneRef.current + 0.5) / laneCount;
      const playerY = height - 52;
      const playerProgress = (playerY - horizonY) / (height - horizonY);
      const currentRoadLeft = roadTopLeft + (roadBottomLeft - roadTopLeft) * playerProgress;
      const currentRoadWidth = (roadTopRight + (roadBottomRight - roadTopRight) * playerProgress) - currentRoadLeft;
      const playerX = currentRoadLeft + currentRoadWidth * playerLaneRatio;

      // Update Run Cycle
      runCycle += dt * 10 * speedRef.current;

      // 4. Particle Generation & Update
      if (stateRef.current === "boost") {
        for (let i = 0; i < 3; i++) {
          particles.push({
            x: playerX + (Math.random() - 0.5) * 20,
            y: playerY + 10,
            vx: (Math.random() - 0.5) * 60,
            vy: 50 + Math.random() * 80,
            life: 1,
            color: Math.random() > 0.5 ? "#fbbf24" : "#34d399",
            size: 3 + Math.random() * 4,
          });
        }
      } else if (stateRef.current === "stumble") {
        for (let i = 0; i < 2; i++) {
          particles.push({
            x: playerX + (Math.random() - 0.5) * 24,
            y: playerY + 5,
            vx: (Math.random() - 0.5) * 80,
            vy: -20 - Math.random() * 40,
            life: 1,
            color: "#f43f5e",
            size: 4 + Math.random() * 3,
          });
        }
      }

      // Render Particles
      if (ctx) {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          if (!p) continue;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt * 2.5;

          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // 5. Render Animated Character
      if (ctx) {
        ctx.save();
        ctx.translate(playerX, playerY);

        // Shadow under player
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.ellipse(0, 16, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Character Aura on Boost
        if (stateRef.current === "boost") {
          ctx.shadowColor = "#34d399";
          ctx.shadowBlur = 18;
          ctx.strokeStyle = "rgba(52, 211, 153, 0.8)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 24, 0, Math.PI * 2);
          ctx.stroke();
        } else if (stateRef.current === "stumble") {
          ctx.shadowColor = "#f43f5e";
          ctx.shadowBlur = 14;
        }

        // Body Avatar
        const legBob = Math.sin(runCycle) * 3;
        const bodyColor = stateRef.current === "boost" ? "#059669" : stateRef.current === "stumble" ? "#e11d48" : "#10b981";

        // Torso / Vest
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.roundRect(-12, -14 + legBob, 24, 22, 6);
        ctx.fill();

        // Head
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(0, -22 + legBob, 10, 0, Math.PI * 2);
        ctx.fill();

        // Running Legs
        const legSwing = Math.sin(runCycle) * 8;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#047857";
        // Left Leg
        ctx.beginPath();
        ctx.moveTo(-6, 8 + legBob);
        ctx.lineTo(-8 + legSwing, 18);
        ctx.stroke();
        // Right Leg
        ctx.beginPath();
        ctx.moveTo(6, 8 + legBob);
        ctx.lineTo(8 - legSwing, 18);
        ctx.stroke();

        // Face / Headband
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-6, -24 + legBob, 12, 3);

        ctx.restore();
      }

      ctx?.restore();
      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [laneCount]);

  return (
    <section
      className="space-y-4 rounded-[2rem] bg-slate-900/90 p-4 shadow-2xl border border-white/10 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Race Progress Bar & Distance Counter */}
      <div className="flex items-center justify-between text-xs font-black text-emerald-300">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            🏁
          </span>
          <span>Jarak Tempuh: {distanceMeters}m</span>
        </div>
        <div className="text-white/60">
          Gunakan tombol arah / sentuh jalur untuk melaju
        </div>
      </div>

      {/* Question Challenge Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-5 text-center border border-emerald-500/30 shadow-inner">
        <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
          Tantangan Lintasan Soal
        </span>
        <h2 className="mt-2 text-2xl font-black leading-relaxed text-white sm:text-3xl">
          {runnerQuestion.questionText}
        </h2>
      </div>

      {/* 60fps HTML5 Canvas Runner Track */}
      <div className="relative w-full overflow-hidden rounded-2xl border-2 border-emerald-500/30 shadow-2xl bg-slate-950">
        <canvas
          ref={canvasRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="h-64 sm:h-72 w-full block cursor-pointer select-none"
        />

        {/* Speed Flash Overlay */}
        {characterState === "boost" && (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-emerald-400/10" />
        )}
      </div>

      {/* Interactive Lane Gates Buttons */}
      <div
        className="grid gap-2 pt-2"
        style={{ gridTemplateColumns: `repeat(${laneCount}, 1fr)` }}
      >
        {runnerQuestion.lanes.map((lane, idx) => (
          <button
            key={lane.optionId}
            type="button"
            disabled={submitting || hasAnswered}
            onClick={() => {
              setActiveLane(idx);
              void handleLaneCommit(idx);
            }}
            className={`flex flex-col items-center justify-between rounded-2xl p-3 font-black transition-all active:scale-95 border-2 ${
              activeLane === idx
                ? "border-emerald-400 bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-102"
                : "border-slate-700 bg-slate-800 text-white/90 hover:border-emerald-500/50 hover:bg-slate-700"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/30 text-xs font-black">
                {lane.optionKey}
              </span>
              <span className="text-[11px] uppercase tracking-wider opacity-75">
                Jalur #{idx + 1}
              </span>
            </div>
            <span className="mt-2 text-center text-sm font-bold line-clamp-2">
              {lane.text}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
