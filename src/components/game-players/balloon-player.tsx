"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { RawQuestion, RawOption } from "@/lib/game-engine/types";

const BALLOON_COLORS = ["#ef4444", "#3b82f6", "#eab308", "#10b981", "#8b5cf6"];

export function BalloonPlayer({
  questions,
  onFinish,
  isRtl = false,
}: {
  questions: RawQuestion[];
  onFinish?: (finalScore: number) => void;
  isRtl?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);

  const activeQuestion = questions[currentQIndex % (questions.length || 1)] || {
    id: "q-mock",
    position: 0,
    question_text: "Pecahkan Balon Jawaban yang Tepat",
    options: [
      { id: "1", option_key: "A", option_text: "Jawaban A" },
      { id: "2", option_key: "B", option_text: "Jawaban B" },
      { id: "3", option_key: "C", option_text: "Jawaban C" },
      { id: "4", option_key: "D", option_text: "Jawaban D" },
    ],
    correct_option_key: "A",
  };

  const correctKey = (activeQuestion.correct_option_key ?? "A").toUpperCase().trim();

  // Balloons state
  const balloonsRef = useRef<
    Array<{
      x: number;
      y: number;
      radius: number;
      vy: number;
      swayOffset: number;
      swaySpeed: number;
      color: string;
      option: RawOption;
      popped: boolean;
    }>
  >([]);

  // Particles
  const particlesRef = useRef<
    Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
    }>
  >([]);

  // Spawn Balloons
  const spawnBalloons = useCallback((width: number, height: number) => {
    const opts = activeQuestion.options.slice(0, 4);
    const spacing = width / (opts.length + 1);

    balloonsRef.current = opts.map((opt, i) => ({
      x: spacing * (i + 1),
      y: height + 60 + Math.random() * 40,
      radius: 46,
      vy: 1.8 + Math.random() * 0.8,
      swayOffset: Math.random() * Math.PI * 2,
      swaySpeed: 0.03 + Math.random() * 0.02,
      color: BALLOON_COLORS[i % BALLOON_COLORS.length]!,
      option: opt,
      popped: false,
    }));
  }, [activeQuestion.options]);

  // Handle Balloon Pop Click
  const handlePopBalloon = useCallback(
    (b: (typeof balloonsRef.current)[0]) => {
      b.popped = true;
      const isCorrect = b.option.option_key.toUpperCase().trim() === correctKey;

      // Spawn burst particles
      for (let i = 0; i < 35; i++) {
        const speed = 2 + Math.random() * 6;
        const angle = Math.random() * Math.PI * 2;
        particlesRef.current.push({
          x: b.x,
          y: b.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 5,
          color: b.color,
          alpha: 1,
        });
      }

      if (isCorrect) {
        playSfx("correct");
        setScore((s) => s + 100 + streak * 20);
        setStreak((st) => st + 1);
        setFeedback({ text: `✓ PECAH TEPAT! +${100 + streak * 20} Poin`, color: "text-emerald-400" });

        setTimeout(() => {
          setFeedback(null);
          if (currentQIndex + 1 < questions.length) {
            setCurrentQIndex((idx) => idx + 1);
          } else {
            setIsGameOver(true);
            onFinish?.(score + 100);
          }
        }, 700);
      } else {
        playSfx("wrong");
        setStreak(0);
        setFeedback({ text: `✗ SALAH! Jawaban Benar: ${correctKey}`, color: "text-rose-400" });
        setTimeout(() => setFeedback(null), 1000);
      }
    },
    [correctKey, currentQIndex, questions.length, streak, score, onFinish],
  );

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 900);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 550);

    spawnBalloons(width, height);

    const render = () => {
      // Clear screen with sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#0c4a6e");
      grad.addColorStop(1, "#0284c7");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw and update balloons
      const balloons = balloonsRef.current;
      for (const b of balloons) {
        if (b.popped) continue;

        b.y -= b.vy;
        b.swayOffset += b.swaySpeed;
        const currentX = b.x + Math.sin(b.swayOffset) * 18;

        // Draw Balloon String
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(currentX, b.y + b.radius);
        ctx.quadraticCurveTo(currentX - 10, b.y + b.radius + 20, currentX, b.y + b.radius + 40);
        ctx.stroke();

        // Draw Balloon
        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 12;
        ctx.ellipse(currentX, b.y, b.radius * 0.9, b.radius * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Balloon Highlight shine
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.ellipse(currentX - b.radius * 0.35, b.y - b.radius * 0.4, 8, 14, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // Balloon Text (Option Key & Text)
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.option.option_key, currentX, b.y - 10);

        const bTextLen = b.option.option_text.length;
        const bFontSize = bTextLen > 10 ? 13 : 16;
        ctx.font = `bold ${bFontSize}px 'Traditional Arabic', Amiri, Tahoma, sans-serif`;
        ctx.fillText(b.option.option_text.slice(0, 15), currentX, b.y + 12);

        // Respawn if floated off top
        if (b.y + b.radius < -30) {
          b.y = height + 50;
        }
      }

      // Draw and update particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]!;
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= 0.03;
        if (pt.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    // Canvas click detection for popping balloons
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      for (const b of balloonsRef.current) {
        if (b.popped) continue;
        const currentX = b.x + Math.sin(b.swayOffset) * 18;
        const dist = Math.hypot(clickX - currentX, clickY - b.y);
        if (dist <= b.radius * 1.1) {
          handlePopBalloon(b);
          break;
        }
      }
    };

    canvas.addEventListener("click", handleClick);

    const handleResize = () => {
      width = canvas.width = canvas.parentElement?.clientWidth || 900;
      height = canvas.height = canvas.parentElement?.clientHeight || 550;
      spawnBalloons(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
    };
  }, [spawnBalloons, handlePopBalloon]);

  return (
    <div className="relative w-full h-[580px] bg-sky-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-4 border-sky-400 select-none">
      {/* Top HUD */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border-b border-white/15 px-4 py-3 text-white backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎈</span>
          <div>
            <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider block">
              PECAHKAN BALON (SOAL #{currentQIndex + 1})
            </span>
            <h3 className="text-base sm:text-lg font-black text-white" dir={isRtl ? "rtl" : "ltr"}>
              {activeQuestion.question_text}
            </h3>
          </div>
        </div>

        <div className="px-4 py-1.5 rounded-xl bg-black/40 font-mono font-black text-amber-400 text-sm border border-white/10">
          {score} Pts
        </div>
      </div>

      {/* Main Canvas */}
      <div className="relative flex-1 w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

        {feedback && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-2xl bg-slate-950/90 border border-white/20 shadow-2xl font-black text-base animate-in zoom-in-95 z-30">
            <span className={feedback.color}>{feedback.text}</span>
          </div>
        )}

        <div className="absolute left-4 bottom-4 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur border border-white/10 text-[11px] text-white/80 z-20">
          🎯 Klik balon yang membawa jawaban yang benar untuk meletuskannya!
        </div>
      </div>

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
          <span className="text-6xl animate-bounce">🎈</span>
          <h2 className="text-3xl font-black">Semua Balon Selesai!</h2>
          <p className="text-xl font-bold font-mono text-emerald-400">Total Skor Akhir: {score} Poin</p>
          <button
            type="button"
            onClick={() => {
              setCurrentQIndex(0);
              setScore(0);
              setStreak(0);
              setIsGameOver(false);
            }}
            className="px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm shadow-xl transition hover:scale-105"
          >
            🔄 Main Lagi
          </button>
        </div>
      )}
    </div>
  );
}
