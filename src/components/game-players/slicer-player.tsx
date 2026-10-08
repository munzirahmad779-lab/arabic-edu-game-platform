"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { GamePlayerProps, RawOption, RawQuestion } from "@/lib/game-engine/types";

interface FlyingFruit {
  id: string;
  option: RawOption;
  isCorrect: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  vRot: number;
  sliced: boolean;
  sliceAngle?: number;
  halves?: {
    h1: { x: number; y: number; vx: number; vy: number; rot: number; vRot: number };
    h2: { x: number; y: number; vx: number; vy: number; rot: number; vRot: number };
  };
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface SlashPoint {
  x: number;
  y: number;
  time: number;
}

export function SlicerPlayer({
  question,
  onSubmitAnswer,
  isRtl,
  onGameEvent,
}: GamePlayerProps<RawQuestion>) {
  const [submitting, setSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [scoreNotification, setScoreNotification] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const slashTrailRef = useRef<SlashPoint[]>([]);
  const isMouseDownRef = useRef(false);
  const fruitsRef = useRef<FlyingFruit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const answeredRef = useRef(false);

  useEffect(() => {
    answeredRef.current = hasAnswered;
  }, [hasAnswered]);

  useEffect(() => {
    setHasAnswered(false);
    setSubmitting(false);
    setScoreNotification(null);
    answeredRef.current = false;
    fruitsRef.current = [];
    particlesRef.current = [];
  }, [question.id]);

  const correctOption = useMemo(() => {
    return (
      question.options.find((o) => o.option_key === question.correct_option_key) ??
      question.options[0]
    );
  }, [question]);

  // Handle cutting a fruit
  const handleSliceFruit = useCallback(
    async (fruit: FlyingFruit, cutAngle: number) => {
      if (answeredRef.current || fruit.sliced) return;

      fruit.sliced = true;
      fruit.sliceAngle = cutAngle;

      // Spawn two halves tumbling apart
      const speed = 160;
      const nx = Math.cos(cutAngle + Math.PI / 2);
      const ny = Math.sin(cutAngle + Math.PI / 2);

      fruit.halves = {
        h1: {
          x: fruit.x - nx * 10,
          y: fruit.y - ny * 10,
          vx: fruit.vx - nx * speed,
          vy: fruit.vy - ny * speed - 50,
          rot: fruit.rotation,
          vRot: fruit.vRot - 3,
        },
        h2: {
          x: fruit.x + nx * 10,
          y: fruit.y + ny * 10,
          vx: fruit.vx + nx * speed,
          vy: fruit.vy + ny * speed - 50,
          rot: fruit.rotation,
          vRot: fruit.vRot + 3,
        },
      };

      // Splash particles
      if (fruit.isCorrect) {
        const particleColors = ["#10b981", "#34d399", "#fbbf24", "#fef08a", "#f43f5e"];
        for (let i = 0; i < 25; i++) {
          const pAngle = Math.random() * Math.PI * 2;
          const pSpeed = 80 + Math.random() * 200;
          particlesRef.current.push({
            x: fruit.x,
            y: fruit.y,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            color: particleColors[Math.floor(Math.random() * particleColors.length)] ?? "#10b981",
            size: 4 + Math.random() * 5,
            life: 0.8,
            maxLife: 0.8,
          });
        }

        setHasAnswered(true);
        setSubmitting(true);
        playSfx("correct");
        setScoreNotification("TEBASAN TEPAT! 🍉🗡️ +150");

        const result = await onSubmitAnswer({
          questionId: question.id,
          selectedOptionId: fruit.option.id,
          answerText: fruit.option.option_text,
          responseTimeMs: 1200,
        });

        onGameEvent?.({
          isCorrect: true,
          scoreAwarded: result.scoreAwarded ?? 150,
          comboMultiplier: 2,
          streak: 1,
          consequence: "boost",
          message: "JUICY CUT! Tebasan Tepat 🍉⚡",
        });

        setSubmitting(false);
      } else {
        // EXPLOSION BLAST FOR BOMB! 💣💥
        const explosionColors = ["#ef4444", "#f97316", "#eab308", "#ffffff", "#334155"];
        for (let i = 0; i < 50; i++) {
          const pAngle = Math.random() * Math.PI * 2;
          const pSpeed = 100 + Math.random() * 320;
          particlesRef.current.push({
            x: fruit.x,
            y: fruit.y,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            color: explosionColors[Math.floor(Math.random() * explosionColors.length)] ?? "#ef4444",
            size: 6 + Math.random() * 8,
            life: 1.0,
            maxLife: 1.0,
          });
        }

        setHasAnswered(true);
        setSubmitting(true);
        playSfx("explosion");
        setScoreNotification("BOOM! MELEDAK KARENA SALAH TEBAS! 💣💥");

        await onSubmitAnswer({
          questionId: question.id,
          selectedOptionId: fruit.option.id,
          answerText: fruit.option.option_text,
          responseTimeMs: 1200,
        });

        onGameEvent?.({
          isCorrect: false,
          scoreAwarded: 0,
          comboMultiplier: 1,
          streak: 0,
          consequence: "stumble",
          message: "BOOM! Kena Bom Kata Salah 💣💥",
        });

        setSubmitting(false);
      }
    },
    [onSubmitAnswer, onGameEvent, question.id],
  );

  // Line segment to circle collision check
  const checkSliceCollision = useCallback(
    (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 5) return;

      const cutAngle = Math.atan2(dy, dx);

      for (const fruit of fruitsRef.current) {
        if (fruit.sliced) continue;

        // Vector from p1 to fruit center
        const fx = fruit.x - p1.x;
        const fy = fruit.y - p1.y;

        // Projection of f onto segment
        const u = Math.max(0, Math.min(len, (fx * dx + fy * dy) / len));
        const closestX = p1.x + (dx / len) * u;
        const closestY = p1.y + (dy / len) * u;

        const dist = Math.hypot(fruit.x - closestX, fruit.y - closestY);
        if (dist <= fruit.radius) {
          void handleSliceFruit(fruit, cutAngle);
        }
      }
    },
    [handleSliceFruit],
  );

  // Spawn flying fruits wave
  useEffect(() => {
    fruitsRef.current = [];
    let spawnTimer = 0;

    function spawnWave() {
      if (answeredRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.clientWidth || 640;
      const height = canvas.clientHeight || 360;

      // Launch 2-4 fruits
      question.options.forEach((opt, idx) => {
        const isCorrect = opt.id === correctOption?.id;
        const startX = width * 0.2 + (width * 0.6 * (idx + 0.5)) / question.options.length;
        const vx = (Math.random() - 0.5) * 80;
        const vy = -(380 + Math.random() * 120);

        fruitsRef.current.push({
          id: `${opt.id}-${Date.now()}-${idx}`,
          option: opt,
          isCorrect,
          x: startX,
          y: height + 40,
          vx,
          vy,
          radius: 46,
          rotation: (Math.random() - 0.5) * 0.5,
          vRot: (Math.random() - 0.5) * 3,
          sliced: false,
          alpha: 1,
        });
      });
    }

    spawnWave();
    spawnTimer = window.setInterval(spawnWave, 4200);

    return () => window.clearInterval(spawnTimer);
  }, [question.options, correctOption]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isMouseDownRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    slashTrailRef.current = [{ x, y, time: performance.now() }];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();

    const trail = slashTrailRef.current;
    if (trail.length > 0) {
      const prev = trail[trail.length - 1];
      if (prev) {
        checkSliceCollision(prev, { x, y });
      }
    }

    trail.push({ x, y, time: now });
  };

  const handlePointerUp = () => {
    isMouseDownRef.current = false;
  };

  // Main 60fps Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();

    function render(time: number) {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas?.clientWidth || 640;
      const height = canvas?.clientHeight || 360;

      if (canvas && (canvas.width !== width * dpr || canvas.height !== height * dpr)) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx?.save();
      ctx?.scale(dpr, dpr);

      // 1. Dojo Wooden / Bamboo Canvas Background
      const bgGrad = ctx?.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width);
      if (bgGrad && ctx) {
        bgGrad.addColorStop(0, "#1e1b4b");
        bgGrad.addColorStop(0.7, "#0f172a");
        bgGrad.addColorStop(1, "#020617");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // Wooden planks grid
      if (ctx) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // 2. Update & Render Fruits
      const gravity = 480;
      const fruits = fruitsRef.current;

      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        if (!f) continue;

        if (!f.sliced) {
          f.vy += gravity * dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.rotation += f.vRot * dt;

          // Remove if fallen past screen
          if (f.y > height + 80 && f.vy > 0) {
            fruits.splice(i, 1);
            continue;
          }

          // Render Whole Fruit Disc
          if (ctx) {
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.rotation);

            // Shadow
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.arc(0, 8, f.radius, 0, Math.PI * 2);
            ctx.fill();

            // Fruit vs Bomb Body
            if (f.isCorrect) {
              // Juicy Watermelon Disc
              const bodyGrad = ctx.createRadialGradient(-10, -10, 5, 0, 0, f.radius);
              bodyGrad.addColorStop(0, "#ec4899");
              bodyGrad.addColorStop(0.7, "#be185d");
              bodyGrad.addColorStop(0.9, "#10b981");
              bodyGrad.addColorStop(1, "#047857");

              ctx.fillStyle = bodyGrad;
              ctx.beginPath();
              ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
              ctx.fill();

              // Green Rind Outer Ring
              ctx.lineWidth = 4;
              ctx.strokeStyle = "#34d399";
              ctx.stroke();
            } else {
              // Iron Bomb Body with Hazard Look
              const bombGrad = ctx.createRadialGradient(-10, -10, 5, 0, 0, f.radius);
              bombGrad.addColorStop(0, "#475569");
              bombGrad.addColorStop(0.6, "#1e293b");
              bombGrad.addColorStop(1, "#020617");

              ctx.fillStyle = bombGrad;
              ctx.beginPath();
              ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
              ctx.fill();

              // Bomb Red Hazard Ring & Burning Fuse Spark
              ctx.lineWidth = 3;
              ctx.strokeStyle = "#f87171";
              ctx.stroke();

              // Draw Fuse & Spark on top of bomb
              ctx.fillStyle = "#fbbf24";
              ctx.beginPath();
              ctx.arc(0, -f.radius - 4, 4, 0, Math.PI * 2);
              ctx.fill();
            }

            // Option Key Badge
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(-24, -24, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#0f172a";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(f.option.option_key, -24, -24);

            // Arabic / Option Text
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 16px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(f.option.option_text, 0, 0);

            ctx.restore();
          }
        } else if (f.halves) {
          // Render Sliced Halves
          const { h1, h2 } = f.halves;
          h1.vy += gravity * dt;
          h1.x += h1.vx * dt;
          h1.y += h1.vy * dt;
          h1.rot += h1.vRot * dt;

          h2.vy += gravity * dt;
          h2.x += h2.vx * dt;
          h2.y += h2.vy * dt;
          h2.rot += h2.vRot * dt;

          f.alpha -= dt * 0.8;
          if (f.alpha <= 0) {
            fruits.splice(i, 1);
            continue;
          }

          if (ctx) {
            ctx.globalAlpha = f.alpha;

            // Half 1
            ctx.save();
            ctx.translate(h1.x, h1.y);
            ctx.rotate(h1.rot);
            ctx.fillStyle = f.isCorrect ? "#059669" : "#0284c7";
            ctx.beginPath();
            ctx.arc(0, 0, f.radius, 0, Math.PI);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Half 2
            ctx.save();
            ctx.translate(h2.x, h2.y);
            ctx.rotate(h2.rot);
            ctx.fillStyle = f.isCorrect ? "#059669" : "#0284c7";
            ctx.beginPath();
            ctx.arc(0, 0, f.radius, Math.PI, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.globalAlpha = 1;
          }
        }
      }

      // 3. Update & Render Particles
      const particles = particlesRef.current;
      if (ctx) {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          if (!p) continue;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 300 * dt;
          p.life -= dt;

          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // 4. Render Glowing Blade Slash Trail
      const trail = slashTrailRef.current;
      const now = performance.now();
      // Filter out points older than 180ms
      slashTrailRef.current = trail.filter((pt) => now - pt.time < 180);

      if (ctx && slashTrailRef.current.length >= 2) {
        const activeTrail = slashTrailRef.current;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Outer Blade Glow
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 14;
        ctx.beginPath();
        activeTrail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        // Inner Sharp Blade
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        activeTrail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        ctx.restore();
      }

      ctx?.restore();
      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <section
      className="space-y-4 rounded-[2rem] bg-slate-900/90 p-4 shadow-2xl border border-white/10 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs font-black text-amber-300">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            🗡️
          </span>
          <span>Mode Tebas Kata (Fruit Ninja)</span>
        </div>
        <div className="text-white/70">
          Geser / tebas kata Arab yang tepat di udara!
        </div>
      </div>

      {/* Challenge Question Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 p-5 text-center border border-violet-500/30 shadow-inner">
        <span className="inline-block rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-300">
          Target Tebasan
        </span>
        <h2 className="mt-2 text-2xl font-black leading-relaxed text-white sm:text-3xl">
          {question.question_text}
        </h2>
      </div>

      {/* Interactive Slicer Canvas */}
      <div className="relative w-full overflow-hidden rounded-2xl border-2 border-violet-500/30 shadow-2xl bg-slate-950">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="h-72 sm:h-80 w-full block cursor-crosshair select-none touch-none"
        />

        {/* Slice Score Notification Pop */}
        {scoreNotification && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="animate-bounce rounded-2xl bg-gradient-to-r from-amber-500 to-emerald-500 px-6 py-3 text-lg font-black text-white shadow-2xl">
              {scoreNotification}
            </div>
          </div>
        )}
      </div>

      {/* Accessible Quick-Touch Options Below Canvas */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
        {question.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={submitting || hasAnswered}
            onClick={() => {
              void handleSliceFruit(
                {
                  id: opt.id,
                  option: opt,
                  isCorrect: opt.id === correctOption?.id,
                  x: 0,
                  y: 0,
                  vx: 0,
                  vy: 0,
                  radius: 40,
                  rotation: 0,
                  vRot: 0,
                  sliced: false,
                  alpha: 1,
                },
                0,
              );
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-95 disabled:opacity-50"
          >
            <span className="rounded bg-violet-600 px-1.5 py-0.5 text-xs text-white">
              {opt.option_key}
            </span>
            <span className="truncate">{opt.option_text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
