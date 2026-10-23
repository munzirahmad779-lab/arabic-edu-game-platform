"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
        question_text: "Pecahkan Balon Jawaban yang Tepat",
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

  const isProcessingHitRef = useRef(false);
  const handlePopBalloonRef = useRef<(b: (typeof balloonsRef.current)[0]) => void>(() => {});

  // Balloons state with adaptive sizing
  const balloonsRef = useRef<
    Array<{
      x: number;
      y: number;
      radiusX: number;
      radiusY: number;
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

  // Spawn Balloons with dynamic adaptive size based on option text length
  const spawnBalloons = useCallback((width: number, height: number) => {
    const opts = activeQuestion.options.slice(0, 4);
    const spacing = width / (opts.length + 1);

    balloonsRef.current = opts.map((opt: RawOption, i: number) => {
      const textLen = (opt.option_text || "").length;
      // Adaptive oval radius so choices never overflow or get truncated
      const radiusX = Math.max(48, Math.min(78, textLen * 3.5 + 28));
      const radiusY = Math.round(radiusX * 1.25);

      return {
        x: spacing * (i + 1),
        y: height + 60 + Math.random() * 40,
        radiusX,
        radiusY,
        vy: 1.8 + Math.random() * 0.8,
        swayOffset: Math.random() * Math.PI * 2,
        swaySpeed: 0.03 + Math.random() * 0.02,
        color: BALLOON_COLORS[i % BALLOON_COLORS.length]!,
        option: opt,
        popped: false,
      };
    });
  }, [activeQuestion.options]);

  // Handle Balloon Pop Click
  const handlePopBalloon = useCallback(
    (b: (typeof balloonsRef.current)[0]) => {
      if (isProcessingHitRef.current || isGameOver) return;
      isProcessingHitRef.current = true;
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
          isProcessingHitRef.current = false;
          if (currentQIndex + 1 < questionList.length) {
            setCurrentQIndex((idx) => idx + 1);
          } else {
            setIsGameOver(true);
            onFinish?.(score + 100 + streak * 20);
          }
        }, 700);
      } else {
        playSfx("wrong");
        setStreak(0);
        setFeedback({ text: `✗ SALAH! Jawaban Benar: ${correctKey}`, color: "text-rose-400" });
        setHealth((h) => {
          if (h <= 1) {
            setTimeout(() => {
              setIsGameOver(true);
              onFinish?.(score);
            }, 600);
            return 0;
          }
          return h - 1;
        });
        setTimeout(() => {
          setFeedback(null);
          isProcessingHitRef.current = false;
        }, 1000);
      }
    },
    [correctKey, currentQIndex, questionList.length, streak, score, onFinish, isGameOver],
  );

  useEffect(() => {
    handlePopBalloonRef.current = handlePopBalloon;
  }, [handlePopBalloon]);

  // Respawn balloons when active question changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const width = canvas.width || canvas.parentElement?.clientWidth || 900;
      const height = canvas.height || canvas.parentElement?.clientHeight || 550;
      spawnBalloons(width, height);
    }
  }, [currentQIndex, spawnBalloons]);

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
        ctx.moveTo(currentX, b.y + b.radiusY);
        ctx.quadraticCurveTo(currentX - 10, b.y + b.radiusY + 18, currentX, b.y + b.radiusY + 36);
        ctx.stroke();

        // Draw Balloon Oval with dynamic adaptive radius
        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 12;
        ctx.ellipse(currentX, b.y, b.radiusX, b.radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Balloon Highlight shine
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.ellipse(currentX - b.radiusX * 0.35, b.y - b.radiusY * 0.35, 8, 14, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // Balloon Option Key Badge
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.option.option_key, currentX, b.y - b.radiusY * 0.35);

        // Adaptive Choice Text (Traditional Arabic font & multiline wrap if needed, NO truncation)
        const fullText = b.option.option_text;
        const words = fullText.split(" ");
        const maxLineWidth = b.radiusX * 1.65;

        if (words.length >= 2 && fullText.length > 10) {
          const mid = Math.ceil(words.length / 2);
          const line1 = words.slice(0, mid).join(" ");
          const line2 = words.slice(mid).join(" ");
          ctx.font = `bold 13px "Traditional Arabic", var(--font-amiri), Amiri, Tahoma, sans-serif`;
          ctx.fillText(line1, currentX, b.y + 4);
          ctx.fillText(line2, currentX, b.y + 22);
        } else {
          let fontSize = 16;
          ctx.font = `bold ${fontSize}px "Traditional Arabic", var(--font-amiri), Amiri, Tahoma, sans-serif`;
          const measured = ctx.measureText(fullText).width;
          if (measured > maxLineWidth && maxLineWidth > 20) {
            fontSize = Math.max(11, Math.floor(fontSize * (maxLineWidth / measured)));
            ctx.font = `bold ${fontSize}px "Traditional Arabic", var(--font-amiri), Amiri, Tahoma, sans-serif`;
          }
          ctx.fillText(fullText, currentX, b.y + 10);
        }

        // Respawn if floated off top
        if (b.y + b.radiusY < -30) {
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
        const dist = Math.hypot(clickX - currentX, (clickY - b.y) / 1.2);
        if (dist <= b.radiusX * 1.15) {
          handlePopBalloonRef.current(b);
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
  }, []); // Run canvas loop once without tearing down on state changes

  return (
    <div
      className="relative w-full h-[580px] bg-sky-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-4 border-sky-400 select-none"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top HUD */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border-b border-white/15 px-4 py-3 text-white backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎈</span>
          <div>
            <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider block">
              PECAHKAN BALON (SOAL #{currentQIndex + 1} / {questionList.length})
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
          <div className="flex items-center gap-1 text-sm bg-black/40 px-3 py-1 rounded-xl border border-white/10">
            {[1, 2, 3].map((h) => (
              <span key={h} className={h <= health ? "text-rose-500 text-lg" : "text-slate-600 text-lg"}>
                ♥
              </span>
            ))}
          </div>

          <div className="px-4 py-1.5 rounded-xl bg-black/40 font-mono font-black text-amber-400 text-sm border border-white/10">
            {score} Pts
          </div>
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
          🎯 Klik balon yang membawa jawaban yang benar untuk meletuskannya! Anda memiliki 3 nyawa.
        </div>
      </div>

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
          <span className="text-6xl animate-bounce">🎈</span>
          <h2 className="text-3xl font-black">Permainan Selesai!</h2>
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
            className="px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm shadow-xl transition hover:scale-105 flex items-center gap-2"
          >
            <span>🎲</span>
            <span>Acak Soal & Main Lagi</span>
          </button>
        </div>
      )}
    </div>
  );
}
