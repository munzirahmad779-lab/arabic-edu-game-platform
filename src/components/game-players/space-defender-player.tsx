"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { RawQuestion, RawOption } from "@/lib/game-engine/types";

type Props = {
  questions: RawQuestion[];
  onFinish?: () => void;
  isRtl?: boolean;
};

type Star = {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
};

type LaserBeam = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  alpha: number;
};

const ASTEROID_COLORS = [
  { border: "#f43f5e", glow: "rgba(244,63,94,0.4)", bg: "#881337", tag: "A" },
  { border: "#38bdf8", glow: "rgba(56,189,248,0.4)", bg: "#0369a1", tag: "B" },
  { border: "#fbbf24", glow: "rgba(251,191,36,0.4)", bg: "#b45309", tag: "C" },
  { border: "#34d399", glow: "rgba(52,211,153,0.4)", bg: "#065f46", tag: "D" },
];

export function SpaceDefenderPlayer({ questions, onFinish, isRtl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  // Ship position (X percentage 0..100)
  const shipPosRef = useRef<number>(50);
  const targetShipPosRef = useRef<number>(50);

  // Visual effects
  const particlesRef = useRef<Particle[]>([]);
  const lasersRef = useRef<LaserBeam[]>([]);
  const starsRef = useRef<Star[]>([]);
  const pulseRef = useRef<number>(0);

  const currentQ = questions[currentIdx] ?? questions[0];
  const options = currentQ?.options ?? [];
  const correctKey = (currentQ?.correct_option_key ?? "A").trim().toUpperCase();

  // Initialize stars once
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * 1000,
        y: Math.random() * 600,
        size: Math.random() * 2 + 0.8,
        speed: Math.random() * 0.4 + 0.1,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }
    starsRef.current = stars;
  }, []);

  // Handle firing at a specific option
  const handleShootOption = useCallback(
    (option: RawOption) => {
      if (selectedTargetKey || isGameOver) return;

      const optKey = option.option_key.toUpperCase();
      setSelectedTargetKey(optKey);

      // Target asteroid index
      const optIdx = options.findIndex((o) => o.id === option.id);
      const targetPercent = optIdx >= 0 ? 15 + (optIdx / Math.max(1, options.length - 1)) * 70 : 50;
      targetShipPosRef.current = targetPercent;

      playSfx("click");

      const canvas = canvasRef.current;
      if (canvas) {
        const startX = (shipPosRef.current / 100) * canvas.width;
        const startY = canvas.height - 45;
        const targetX = (targetPercent / 100) * canvas.width;
        const targetY = 160;

        // Add laser beam
        lasersRef.current.push({
          x1: startX,
          y1: startY,
          x2: targetX,
          y2: targetY,
          color: optKey === correctKey ? "#34d399" : "#f43f5e",
          alpha: 1.0,
        });

        // Spawn hit particles
        const pColor = optKey === correctKey ? "#34d399" : "#f43f5e";
        for (let i = 0; i < 28; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 4 + 1.5;
          particlesRef.current.push({
            x: targetX,
            y: targetY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 4 + 2,
            color: pColor,
            alpha: 1.0,
            life: 30,
          });
        }
      }

      const isCorrect = optKey === correctKey;

      if (isCorrect) {
        setFeedback("correct");
        playSfx("correct");
        playSfx("boost");
        setScore((s) => s + 100 + streak * 20);
        setStreak((st) => st + 1);
      } else {
        setFeedback("wrong");
        playSfx("wrong");
        setStreak(0);
      }

      // Transition to next question after 1.2s
      setTimeout(() => {
        setFeedback(null);
        setSelectedTargetKey(null);
        if (currentIdx + 1 < questions.length) {
          setCurrentIdx((idx) => idx + 1);
        } else {
          setIsGameOver(true);
          onFinish?.();
        }
      }, 1200);
    },
    [selectedTargetKey, isGameOver, options, correctKey, streak, currentIdx, questions.length, onFinish]
  );

  // Keyboard navigation (A/D or Arrows to move, Space/Enter or 1-4 to shoot)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedTargetKey || isGameOver) return;

      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        targetShipPosRef.current = Math.max(10, targetShipPosRef.current - 15);
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        targetShipPosRef.current = Math.min(90, targetShipPosRef.current + 15);
      } else if (e.key >= "1" && e.key <= "4") {
        const idx = parseInt(e.key, 10) - 1;
        if (options[idx]) handleShootOption(options[idx]);
      } else if (e.code === "Space" || e.code === "Enter") {
        // Shoot closest asteroid
        let closestIdx = 0;
        let minDiff = 999;
        options.forEach((_, i) => {
          const targetX = 15 + (i / Math.max(1, options.length - 1)) * 70;
          const diff = Math.abs(targetX - targetShipPosRef.current);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        });
        if (options[closestIdx]) handleShootOption(options[closestIdx]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTargetKey, isGameOver, options, handleShootOption]);

  // Main 60 FPS Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      if (containerRef.current && canvas) {
        const rect = containerRef.current.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = Math.max(340, rect.height || 420);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      animId = requestAnimationFrame(render);
      const w = canvas.width;
      const h = canvas.height;

      // 1. Clear background & space gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, "#030712");
      bgGrad.addColorStop(0.5, "#0b0f19");
      bgGrad.addColorStop(1, "#111827");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Cosmic nebula glow
      ctx.save();
      const nebula = ctx.createRadialGradient(w * 0.5, h * 0.3, 20, w * 0.5, h * 0.3, w * 0.6);
      nebula.addColorStop(0, "rgba(56, 189, 248, 0.08)");
      nebula.addColorStop(0.5, "rgba(139, 92, 246, 0.05)");
      nebula.addColorStop(1, "transparent");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // 2. Animate and draw stars
      ctx.fillStyle = "#ffffff";
      starsRef.current.forEach((st) => {
        st.y += st.speed;
        if (st.y > h) st.y = 0;
        ctx.save();
        ctx.globalAlpha = st.opacity * (0.6 + 0.4 * Math.sin(pulseRef.current * 2 + st.x));
        ctx.beginPath();
        ctx.arc((st.x / 1000) * w, st.y, st.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      pulseRef.current += 0.04;

      // 3. Update ship position with smooth spring easing
      shipPosRef.current += (targetShipPosRef.current - shipPosRef.current) * 0.15;
      const shipX = (shipPosRef.current / 100) * w;
      const shipY = h - 45;

      // 4. Draw Lasers
      lasersRef.current.forEach((laser, idx) => {
        ctx.save();
        ctx.strokeStyle = laser.color;
        ctx.lineWidth = 4 * laser.alpha;
        ctx.shadowColor = laser.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        ctx.restore();

        laser.alpha -= 0.08;
        if (laser.alpha <= 0) lasersRef.current.splice(idx, 1);
      });

      // 5. Draw Particles
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 1 / p.life;
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.alpha <= 0) particlesRef.current.splice(idx, 1);
      });

      // 6. Draw Defender Spaceship
      ctx.save();
      ctx.translate(shipX, shipY);

      // Engine thruster flame
      const thrusterHeight = 12 + Math.sin(pulseRef.current * 8) * 4;
      const flameGrad = ctx.createLinearGradient(0, 10, 0, 10 + thrusterHeight);
      flameGrad.addColorStop(0, "#38bdf8");
      flameGrad.addColorStop(0.6, "#f59e0b");
      flameGrad.addColorStop(1, "transparent");
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-6, 12);
      ctx.lineTo(0, 14 + thrusterHeight);
      ctx.lineTo(6, 12);
      ctx.closePath();
      ctx.fill();

      // Ship Wings & Hull
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 12;

      // Left wing
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(-24, 12);
      ctx.lineTo(-12, 10);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right wing
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(24, 12);
      ctx.lineTo(12, 10);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit cabin
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.ellipse(0, -6, 5, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Blaster Cannons
      ctx.fillStyle = "#06b6d4";
      ctx.fillRect(-18, -4, 3, 10);
      ctx.fillRect(15, -4, 3, 10);

      ctx.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (isGameOver) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-white bg-slate-950 rounded-3xl border border-cyan-500/30">
        <span className="text-6xl animate-bounce mb-3">🚀</span>
        <h2 className="text-3xl font-black text-cyan-400">Misi Antariksa Selesai!</h2>
        <p className="text-slate-300 text-sm mt-1">Seluruh asteroid jawaban berhasil dinavigasi dengan tepat.</p>
        <div className="my-6 p-5 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-center min-w-[240px]">
          <span className="text-xs uppercase text-cyan-300 font-bold block mb-1">Skor Akhir</span>
          <span className="text-5xl font-black font-mono text-cyan-300">{score}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setCurrentIdx(0);
            setScore(0);
            setStreak(0);
            setIsGameOver(false);
          }}
          className="px-6 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm shadow-xl transition"
        >
          🔄 Mainkan Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full flex flex-col justify-between select-none" dir={isRtl ? "rtl" : "ltr"}>
      {/* Question Header Card */}
      <div className="relative z-10 mb-3 p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-cyan-500/30 shadow-2xl backdrop-blur text-center">
        <div className="flex items-center justify-between text-xs font-mono font-bold text-cyan-400 mb-2">
          <span>
            SOAL {currentIdx + 1} / {questions.length}
          </span>
          <div className="flex items-center gap-3">
            {streak > 1 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                🔥 STREAK x{streak}
              </span>
            )}
            <span className="text-cyan-300 font-black text-sm">{score} POIN</span>
          </div>
        </div>

        <h2
          className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-relaxed"
          style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
          dir="auto"
        >
          {currentQ?.question_text}
        </h2>
      </div>

      {/* Interactive 60 FPS Canvas Screen */}
      <div ref={containerRef} className="relative w-full min-h-[460px] sm:min-h-[480px] md:min-h-[520px] rounded-3xl overflow-hidden border border-cyan-500/20 shadow-2xl">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

        {/* Floating Asteroid Targets (The Options) */}
        <div className="absolute top-4 inset-x-2 sm:inset-x-6 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 z-20">
          {options.map((opt, i) => {
            const colorSpec = ASTEROID_COLORS[i % ASTEROID_COLORS.length]!;
            const optKey = opt.option_key.toUpperCase();
            const isPicked = selectedTargetKey === optKey;
            const isCorrectTarget = optKey === correctKey;

            let cardStateClass = "hover:scale-[1.03] active:scale-95";
            if (isPicked) {
              cardStateClass = isCorrectTarget
                ? "ring-4 ring-emerald-400 scale-105 shadow-[0_0_35px_rgba(52,211,153,0.8)]"
                : "ring-4 ring-rose-500 scale-95 opacity-80 shadow-[0_0_35px_rgba(244,63,94,0.8)]";
            }

            return (
              <button
                key={opt.id}
                type="button"
                disabled={Boolean(selectedTargetKey)}
                onClick={() => handleShootOption(opt)}
                className={`relative p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all duration-200 backdrop-blur-md flex flex-col justify-between min-h-[110px] sm:min-h-[125px] ${cardStateClass}`}
                style={{
                  backgroundColor: "rgba(15, 23, 42, 0.88)",
                  borderColor: colorSpec.border,
                  boxShadow: `0 8px 24px ${colorSpec.glow}`,
                }}
              >
                {/* Asteroid Key Tag */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white font-black text-xs shadow-md"
                    style={{ backgroundColor: colorSpec.bg, border: `1px solid ${colorSpec.border}` }}
                  >
                    {optKey}
                  </span>
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">
                    ASTEROID #{i + 1}
                  </span>
                </div>

                {/* Option Text */}
                <div
                  className="text-base sm:text-lg font-bold text-white leading-normal break-words"
                  style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                  dir="auto"
                >
                  {opt.option_text}
                </div>

                {/* Blaster Target Reticle hint */}
                <div className="mt-2 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-cyan-300/80 font-bold">
                  <span>🚀 TEMBAK</span>
                  <span>[{i + 1}]</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Center Feedback Badge */}
        {feedback && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div
              className={`px-8 py-4 rounded-3xl border-2 shadow-2xl backdrop-blur-lg flex items-center gap-3 animate-in zoom-in-95 ${
                feedback === "correct"
                  ? "bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-emerald-500/50"
                  : "bg-rose-950/90 border-rose-500 text-rose-200 shadow-rose-500/50"
              }`}
            >
              <span className="text-4xl">{feedback === "correct" ? "🎯" : "🛡️"}</span>
              <div>
                <span className="text-lg font-black block">
                  {feedback === "correct" ? "TEMBAKAN TEPAT! +100" : "TERLINDUNGI PERISAI!"}
                </span>
                <span className="text-xs opacity-90">
                  {feedback === "correct" ? "Asteroid hancur sempurna" : "Jawaban kurang tepat"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Ship Guidance / Control Bar */}
        <div className="absolute bottom-2 inset-x-3 z-20 flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-950/70 p-2 rounded-xl backdrop-blur border border-white/10">
          <span>🕹️ Panah ⬅️ ➡️ / W-S untuk manuver, 1-4 / Spasi untuk tembak</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                targetShipPosRef.current = Math.max(10, targetShipPosRef.current - 20);
              }}
              className="px-2 py-0.5 rounded bg-white/10 text-white font-bold hover:bg-white/20 active:scale-95"
            >
              ⬅️ Kiri
            </button>
            <button
              type="button"
              onClick={() => {
                targetShipPosRef.current = Math.min(90, targetShipPosRef.current + 20);
              }}
              className="px-2 py-0.5 rounded bg-white/10 text-white font-bold hover:bg-white/20 active:scale-95"
            >
              Kanan ➡️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
