"use client";

import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type { RawQuestion } from "@/lib/game-engine/types";

const SEGMENT_COLORS = [
  "#e11d48", "#2563eb", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"
];

export function WheelPlayer({
  questions,
  onFinish,
  isRtl = false,
}: {
  questions: RawQuestion[];
  onFinish?: (finalScore: number) => void;
  isRtl?: boolean;
}) {
  const [questionList, setQuestionList] = useState<RawQuestion[]>(() =>
    [...questions].sort(() => Math.random() - 0.5),
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  const handleReshuffle = () => {
    setQuestionList([...questions].sort(() => Math.random() - 0.5));
    setCurrentQIndex(0);
    setScore(0);
    setSpinResult(null);
    setIsFinished(false);
  };

  const activeQuestion = questionList[currentQIndex % (questionList.length || 1)] || {
    id: "q-mock",
    position: 0,
    question_text: "Putar Roda Keberuntungan",
    options: [
      { id: "1", option_key: "A", option_text: "Jawaban A" },
      { id: "2", option_key: "B", option_text: "Jawaban B" },
      { id: "3", option_key: "C", option_text: "Jawaban C" },
      { id: "4", option_key: "D", option_text: "Jawaban D" },
    ],
    correct_option_key: "A",
  };

  const correctKey = (activeQuestion.correct_option_key ?? "A").toUpperCase().trim();

  // Wheel physics state
  const wheelRef = useRef({
    angle: 0,
    angularVelocity: 0,
    friction: 0.985,
  });

  const segments = useMemo(() => {
    return activeQuestion.options.slice(0, 6);
  }, [activeQuestion.options]);

  // Spin wheel action
  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setSpinResult(null);
    playSfx("boost");

    // Give high random angular velocity (spins 4-7 seconds)
    wheelRef.current.angularVelocity = 0.35 + Math.random() * 0.25;
  };

  // Canvas Render Loop for Physics Wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const size = 380;
    canvas.width = size;
    canvas.height = size;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 15;
    const numSegments = segments.length || 4;
    const arcSize = (Math.PI * 2) / numSegments;

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      const w = wheelRef.current;
      if (w.angularVelocity > 0.002) {
        w.angle += w.angularVelocity;
        w.angularVelocity *= w.friction;
      } else if (w.angularVelocity > 0) {
        w.angularVelocity = 0;
        setIsSpinning(false);

        // Determine which segment is at the pointer (top: angle = -PI/2)
        const normalizedAngle = (Math.PI * 2 - (w.angle % (Math.PI * 2))) % (Math.PI * 2);
        const pointerOffset = (normalizedAngle + Math.PI / 2) % (Math.PI * 2);
        const winningIndex = Math.floor(pointerOffset / arcSize) % numSegments;
        const picked = segments[winningIndex];

        if (picked) {
          const isCorrect = picked.option_key.toUpperCase().trim() === correctKey;
          if (isCorrect) {
            playSfx("correct");
            setScore((s) => s + 150);
            setSpinResult(`✓ TEPAT! ${picked.option_key} (+150 Poin)`);
          } else {
            playSfx("wrong");
            setSpinResult(`✗ SALAH: ${picked.option_key} (Bukan ${correctKey})`);
          }

          // Otomatis lanjut ke soal berikutnya setelah putaran selesai (delay 1.8 detik)
          setTimeout(() => {
            if (currentQIndex + 1 < questionList.length) {
              setCurrentQIndex((idx) => idx + 1);
              setSpinResult(null);
            } else {
              setIsFinished(true);
              onFinish?.(score + (isCorrect ? 150 : 0));
            }
          }, 1800);
        }
      }

      // Draw Wheel Segments
      for (let i = 0; i < numSegments; i++) {
        const segAngle = w.angle + i * arcSize;
        ctx.beginPath();
        ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length]!;
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, segAngle, segAngle + arcSize);
        ctx.lineTo(centerX, centerY);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Text inside segment
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(segAngle + arcSize / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px sans-serif";
        const opt = segments[i];
        if (opt) {
          ctx.fillText(`${opt.option_key}: ${opt.option_text.slice(0, 10)}`, radius - 20, 5);
        }
        ctx.restore();
      }

      // Draw Center Hub
      ctx.beginPath();
      ctx.arc(centerX, centerY, 28, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("RODA", centerX, centerY);

      // Draw Pointer Arrow at Top
      ctx.beginPath();
      ctx.moveTo(centerX - 14, 5);
      ctx.lineTo(centerX + 14, 5);
      ctx.lineTo(centerX, 28);
      ctx.closePath();
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [segments, correctKey]);

  return (
    <div
      className="relative w-full h-[580px] bg-gradient-to-b from-indigo-950 to-slate-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-4 border-indigo-500 select-none p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/60 border border-white/20 p-3.5 rounded-2xl text-white backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎡</span>
          <div>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
              RODA PUTAR SOAL #{currentQIndex + 1} / {questionList.length}
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReshuffle}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-amber-300 border border-amber-300/30 transition flex items-center gap-1.5"
            title="Acak urutan soal"
          >
            <span>🎲</span> Acak Soal
          </button>
          <div className="px-4 py-1.5 rounded-xl bg-black/40 font-mono font-black text-amber-400 text-sm border border-white/10">
            {score} Pts
          </div>
        </div>
      </div>

      {/* Main Wheel View or Finished View */}
      {isFinished ? (
        <div className="flex flex-col items-center justify-center my-auto z-10 py-6 text-center">
          <span className="text-6xl animate-bounce">🏆</span>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-4">Kuis Roda Selesai!</h2>
          <p className="text-amber-400 font-bold mt-1 text-lg">Skor Akhir: {score} Poin</p>
          <button
            type="button"
            onClick={handleReshuffle}
            className="mt-6 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-base shadow-2xl transition transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <span>🎲</span> Acak Soal & Putar Lagi
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center my-auto z-10 py-2">
          <div className="relative">
            <canvas ref={canvasRef} className="block drop-shadow-2xl" />
          </div>

          {/* Spin Button */}
          <button
            type="button"
            disabled={isSpinning}
            onClick={handleSpin}
            className={`mt-4 px-8 py-3 rounded-2xl font-black text-sm shadow-xl transition transform active:scale-95 ${
              isSpinning
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 hover:scale-105"
            }`}
          >
            {isSpinning ? "🌀 Roda Sedang Berputar..." : "🎯 PUTAR RODA (KLIK SINI)"}
          </button>

          {/* Result Announcement */}
          {spinResult && (
            <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-white/20 text-center animate-in zoom-in-95">
              <span className="font-black text-sm text-amber-300">{spinResult}</span>
              <button
                type="button"
                onClick={() => {
                  setSpinResult(null);
                  if (currentQIndex + 1 < questionList.length) {
                    setCurrentQIndex((idx) => idx + 1);
                  } else {
                    setIsFinished(true);
                    onFinish?.(score);
                  }
                }}
                className="ml-3 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Soal Selanjutnya →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer Instructions */}
      <div className="text-center text-xs text-indigo-300/80 bg-black/40 py-2 rounded-xl">
        Putar roda fisika karnaval untuk mendaratkan jarum pada jawaban yang tepat!
      </div>
    </div>
  );
}

function useMemo<T>(fn: () => T, deps: unknown[]): T {
  const ref = useRef<{ value: T; deps: unknown[] } | null>(null);
  if (!ref.current || !deps.every((d, i) => d === ref.current?.deps[i])) {
    ref.current = { value: fn(), deps };
  }
  return ref.current.value;
}
