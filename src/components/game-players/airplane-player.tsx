"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { RawQuestion, RawOption } from "@/lib/game-engine/types";

export function AirplanePlayer({
  questions,
  onFinish,
  isRtl = false,
}: {
  questions: RawQuestion[];
  onFinish?: (finalScore: number) => void;
  isRtl?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [questionList, setQuestionList] = useState(() => [...questions]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [health, setHealth] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null);

  const activeQuestion = useMemo(() => {
    return (
      questionList[currentQIndex % (questionList.length || 1)] || {
        id: "q-mock",
        position: 0,
        question_text: "Soal Kuis Pesawat",
        options: [
          { id: "1", option_key: "A", option_text: "Jawaban A" },
          { id: "2", option_key: "B", option_text: "Jawaban B" },
          { id: "3", option_key: "C", option_text: "Jawaban C" },
          { id: "4", option_key: "D", option_text: "Jawaban D" },
        ],
        correct_option_key: "A",
      }
    );
  }, [questionList, currentQIndex]);

  const correctKey = (activeQuestion.correct_option_key ?? "A").toUpperCase().trim();

  // Plane physics state
  const planeRef = useRef({
    x: 100,
    y: 200,
    targetY: 200,
    vy: 0,
    angle: 0,
    propellerAngle: 0,
  });

  // Clouds representing options
  const cloudsRef = useRef<
    Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      option: RawOption;
      hit: boolean;
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

  // Spawn clouds for current question
  const spawnClouds = useCallback((width: number, height: number) => {
    const opts = activeQuestion.options.slice(0, 4);
    const cloudHeight = 72;
    const availableHeight = height - 120;
    const slotHeight = availableHeight / Math.max(opts.length, 1);

    cloudsRef.current = opts.map((opt, i) => {
      const centerY = 90 + i * slotHeight + slotHeight / 2;
      const textLen = (opt.option_text || "").length;
      // Adaptive cloud width so full text fits without truncation
      const cloudWidth = Math.max(200, Math.min(340, textLen * 9.5 + 85));

      return {
        x: width + 50 + (i % 2 === 0 ? 0 : 75), // slightly staggered
        y: centerY - cloudHeight / 2,
        width: cloudWidth,
        height: cloudHeight,
        option: opt,
        hit: false,
      };
    });
  }, [activeQuestion]);

  // Handle Answer Hit
  const handleHitCloud = useCallback(
    (opt: RawOption) => {
      const isCorrect = opt.option_key.toUpperCase().trim() === correctKey;

      // Spawn burst particles
      const p = planeRef.current;
      for (let i = 0; i < 30; i++) {
        const speed = 2 + Math.random() * 6;
        const angle = Math.random() * Math.PI * 2;
        particlesRef.current.push({
          x: p.x + 35,
          y: p.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 5,
          color: isCorrect ? (Math.random() > 0.5 ? "#10b981" : "#fbbf24") : "#ef4444",
          alpha: 1,
        });
      }

      if (isCorrect) {
        playSfx("correct");
        setScore((s) => s + 100 + streak * 20);
        setStreak((st) => st + 1);
        setFeedback({ text: `✓ TEPAT! +${100 + streak * 20} Poin`, color: "text-emerald-400" });

        setTimeout(() => {
          setFeedback(null);
          if (currentQIndex + 1 < questions.length) {
            setCurrentQIndex((idx) => idx + 1);
          } else {
            setIsGameOver(true);
            onFinish?.(score + 100);
          }
        }, 800);
      } else {
        playSfx("wrong");
        setStreak(0);
        setHealth((h) => {
          const next = h - 1;
          if (next <= 0) {
            setIsGameOver(true);
            onFinish?.(score);
          }
          return Math.max(0, next);
        });
        setFeedback({ text: `✗ KURANG TEPAT! Jawaban: ${correctKey}`, color: "text-rose-400" });

        setTimeout(() => {
          setFeedback(null);
          if (currentQIndex + 1 < questions.length) {
            setCurrentQIndex((idx) => idx + 1);
          } else {
            setIsGameOver(true);
          }
        }, 1200);
      }
    },
    [correctKey, currentQIndex, questions.length, streak, score, onFinish],
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        planeRef.current.targetY = Math.max(80, planeRef.current.targetY - 50);
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        planeRef.current.targetY = Math.min(450, planeRef.current.targetY + 50);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Main Canvas Render Loop (60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 900);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 550);

    spawnClouds(width, height);

    let backgroundOffset = 0;

    const render = () => {
      // Clear screen with sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#0284c7");
      skyGrad.addColorStop(0.6, "#38bdf8");
      skyGrad.addColorStop(1, "#bae6fd");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Background moving distant hills & fluffy clouds
      backgroundOffset = (backgroundOffset + 1) % width;
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 220 - backgroundOffset) % width + width) % width;
        ctx.beginPath();
        ctx.arc(cx, 120 + (i % 2) * 80, 50, 0, Math.PI * 2);
        ctx.arc(cx + 40, 110 + (i % 2) * 80, 65, 0, Math.PI * 2);
        ctx.arc(cx + 80, 120 + (i % 2) * 80, 50, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update plane position (smooth easing towards targetY)
      const plane = planeRef.current;
      const dy = plane.targetY - plane.y;
      plane.vy = dy * 0.12;
      plane.y += plane.vy;
      plane.angle = (plane.vy / 20) * 0.4;
      plane.propellerAngle += 0.5;

      // Draw Airplane
      ctx.save();
      ctx.translate(plane.x, plane.y);
      ctx.rotate(plane.angle);

      // Plane Body (Red cartoon monoplane)
      ctx.fillStyle = "#e11d48";
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cockpit Window
      ctx.fillStyle = "#7dd3fc";
      ctx.beginPath();
      ctx.arc(6, -6, 8, 0, Math.PI * 2);
      ctx.fill();

      // Wing
      ctx.fillStyle = "#be123c";
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(8, -4);
      ctx.lineTo(2, 18);
      ctx.lineTo(-4, 18);
      ctx.closePath();
      ctx.fill();

      // Tail Fin
      ctx.fillStyle = "#be123c";
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(-40, -18);
      ctx.lineTo(-24, -18);
      ctx.lineTo(-20, 0);
      ctx.closePath();
      ctx.fill();

      // Spinning Propeller
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(38, Math.sin(plane.propellerAngle) * 16);
      ctx.lineTo(38, -Math.sin(plane.propellerAngle) * 16);
      ctx.stroke();

      ctx.restore();

      // Spawn subtle smoke puff behind plane
      if (Math.random() < 0.4) {
        particlesRef.current.push({
          x: plane.x - 34,
          y: plane.y + (Math.random() - 0.5) * 6,
          vx: -2 - Math.random() * 2,
          vy: (Math.random() - 0.5) * 1,
          size: 4 + Math.random() * 6,
          color: "#ffffff",
          alpha: 0.6,
        });
      }

      // Update and Draw Clouds (Choices)
      const clouds = cloudsRef.current;
      for (const cl of clouds) {
        if (cl.hit) continue;
        cl.x -= 2.8; // cloud speed

        // Draw Adaptive Cloud Shape
        ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
        ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
        ctx.shadowBlur = 12;

        const left = cl.x;
        const top = cl.y;
        const w = cl.width;
        const h = cl.height;
        const r = h / 2;

        // Base rounded pill shape
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(left, top, w, h, r);
        } else {
          ctx.rect(left, top, w, h);
        }
        ctx.fill();

        // Fluffy cumulus cloud bubbles on top and sides
        ctx.beginPath();
        ctx.arc(left + 26, top + 10, 22, 0, Math.PI * 2);
        ctx.arc(left + w * 0.35, top + 4, 26, 0, Math.PI * 2);
        ctx.arc(left + w * 0.65, top + 2, 27, 0, Math.PI * 2);
        ctx.arc(left + w - 26, top + 10, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Choice Badge (A, B, C, D)
        const badgeX = left + 22;
        const badgeY = top + h / 2;
        ctx.fillStyle = "#0284c7";
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(cl.option.option_key, badgeX, badgeY);

        // Adaptive Choice Text (Traditional Arabic font & scalable size to prevent truncation)
        const text = cl.option.option_text;
        const availTextWidth = w - 55;
        let fontSize = 15;
        ctx.font = `bold ${fontSize}px "Traditional Arabic", var(--font-amiri), Amiri, Tahoma, sans-serif`;
        const measured = ctx.measureText(text).width;

        ctx.fillStyle = "#0f172a";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        if (measured > availTextWidth && text.includes(" ")) {
          // 2-line auto-wrap for Indonesian sentences or multi-word phrases
          const words = text.split(" ");
          const mid = Math.ceil(words.length / 2);
          const line1 = words.slice(0, mid).join(" ");
          const line2 = words.slice(mid).join(" ");
          const maxLineWidth = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width, 1);
          if (maxLineWidth > availTextWidth) {
            fontSize = Math.min(14, Math.max(11, Math.floor(fontSize * (availTextWidth / maxLineWidth))));
            ctx.font = `bold ${fontSize}px "Traditional Arabic", var(--font-amiri), Amiri, Tahoma, sans-serif`;
          }
          ctx.fillText(line1, left + 44, badgeY - 10);
          ctx.fillText(line2, left + 44, badgeY + 11);
        } else {
          if (measured > availTextWidth && availTextWidth > 30) {
            fontSize = Math.max(11, Math.floor(fontSize * (availTextWidth / measured)));
            ctx.font = `bold ${fontSize}px "Traditional Arabic", var(--font-amiri), Amiri, Tahoma, sans-serif`;
          }
          ctx.fillText(text, left + 44, badgeY);
        }

        // Collision Check with Plane
        const planeX = plane.x;
        const planeY = plane.y;
        const isHitX = planeX >= left - 25 && planeX <= left + w + 15;
        const isHitY = Math.abs(planeY - badgeY) <= h / 2 + 20;

        if (isHitX && isHitY) {
          cl.hit = true;
          handleHitCloud(cl.option);
        }

        // Respawn cloud if went off-screen without hit
        if (cl.x + cl.width < -60) {
          cl.x = width + 60;
        }
      }

      // Update and Draw Particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]!;
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= 0.025;
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

    const handleResize = () => {
      width = canvas.width = canvas.parentElement?.clientWidth || 900;
      height = canvas.height = canvas.parentElement?.clientHeight || 550;
      spawnClouds(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [spawnClouds, handleHitCloud]);

  return (
    <div
      className="relative w-full h-[580px] bg-sky-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-2 border-sky-400 select-none"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top HUD: Question & Stats */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border-b border-white/15 px-4 py-3 text-white backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✈️</span>
          <div>
            <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider block">
              SOAL #{currentQIndex + 1} / {questions.length}
            </span>
            <h3
              className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-[1.6]"
              style={{ fontFamily: "'Traditional Arabic', var(--font-amiri), Amiri, Tahoma, serif" }}
              dir="auto"
            >
              {activeQuestion.question_text}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Health Hearts */}
          <div className="flex items-center gap-1 text-sm">
            {[1, 2, 3].map((h) => (
              <span key={h} className={h <= health ? "text-rose-500 text-lg" : "text-slate-600 text-lg"}>
                ♥
              </span>
            ))}
          </div>

          {/* Score Badge */}
          <div className="px-3 py-1 rounded-xl bg-black/40 border border-white/10 font-mono font-black text-amber-400 text-sm">
            {score} Pts
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative flex-1 w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

        {/* Feedback Alert Overlay */}
        {feedback && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-2xl bg-slate-950/90 border border-white/20 shadow-2xl font-black text-base animate-in zoom-in-95">
            <span className={feedback.color}>{feedback.text}</span>
          </div>
        )}

        {/* Touch / Mouse Click Steer Controls */}
        <div className="absolute right-4 bottom-4 flex flex-col gap-2 z-20">
          <button
            type="button"
            onClick={() => {
              planeRef.current.targetY = Math.max(80, planeRef.current.targetY - 60);
              playSfx("click");
            }}
            className="w-14 h-14 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 text-white font-black text-xl shadow-lg transition active:scale-90 flex items-center justify-center"
            title="Terbang Naik (W / Panah Atas)"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => {
              planeRef.current.targetY = Math.min(460, planeRef.current.targetY + 60);
              playSfx("click");
            }}
            className="w-14 h-14 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 text-white font-black text-xl shadow-lg transition active:scale-90 flex items-center justify-center"
            title="Terbang Turun (S / Panah Bawah)"
          >
            ▼
          </button>
        </div>

        {/* Instructions Hint */}
        <div className="absolute left-4 bottom-4 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur border border-white/10 text-[11px] text-white/80 z-20">
          🎮 Kemudikan pesawat menabrak awan dengan jawaban yang benar! (Gunakan tombol ▲ ▼ atau Keyboard W / S)
        </div>
      </div>

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
          <span className="text-6xl animate-bounce">🛬</span>
          <h2 className="text-3xl font-black">Penerbangan Selesai!</h2>
          <p className="text-xl font-bold font-mono text-emerald-400">Total Skor Akhir: {score} Poin</p>
          <button
            type="button"
            onClick={() => {
              setQuestionList([...questions].sort(() => Math.random() - 0.5));
              setCurrentQIndex(0);
              setScore(0);
              setHealth(3);
              setStreak(0);
              setIsGameOver(false);
            }}
            className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl transition hover:scale-105 flex items-center gap-2"
          >
            <span>🎲</span>
            <span>Acak Soal & Terbang Lagi</span>
          </button>
        </div>
      )}
    </div>
  );
}
