"use client";

import { useEffect, useRef, useState } from "react";
import { PARTICLE_BUDGET, reducedMotion } from "@/lib/motion/tokens";

/* ------------------------------------------------------------------ */
/* Util                                                               */
/* ------------------------------------------------------------------ */

type Ctx = CanvasRenderingContext2D;

function useCanvas(
  draw: (ctx: Ctx, w: number, h: number, api: { pointer: () => { x: number; y: number } | null; resetPointer: () => void }, click: { get: () => { x: number; y: number } | null; clear: () => void }) => (() => void) | void,
  onMount?: (w: number, h: number) => void,
) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stop: (() => void) | void;
    let pointer: { x: number; y: number } | null = null;
    let clickAt: { x: number; y: number } | null = null;
    let disposed = false;

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: rect.width, h: rect.height };
    };

    let dims = size();
    onMount?.(dims.w, dims.h);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => {
      pointer = null;
    };
    const onClick = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      clickAt = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onResize = () => {
      dims = size();
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onClick);
    window.addEventListener("resize", onResize);

    const loop = () => {
      if (disposed) return;
      const w = dims.w;
      const h = dims.h;
      ctx.clearRect(0, 0, w, h);
      const maybe = draw(ctx, w, h, {
        pointer: () => pointer,
        resetPointer: () => {
          pointer = null;
        },
      }, {
        get: () => clickAt,
        clear: () => {
          clickAt = null;
        },
      });
      if (typeof maybe === "function") stop = maybe;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (typeof stop === "function") stop();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, [draw, onMount]);

  return ref;
}

/* ------------------------------------------------------------------ */
/* 1. MANCING — kail + senar (verlet) + ikan sinusoidal               */
/* ------------------------------------------------------------------ */

type Node = { x: number; y: number; px: number; py: number };
type Fish = { x: number; y: number; phase: number; speed: number; size: number };
type Splash = { x: number; y: number; vx: number; vy: number; life: number };

function FishingMotif() {
  const nodesRef = useRef<Node[]>([]);
  const fishRef = useRef<Fish[]>([]);
  const splashRef = useRef<Splash[]>([]);
  const scoreRef = useRef(0);
  const stateRef = useRef<"idle" | "casting" | "hooked">("idle");
  const [, setScore] = useState(0);

  const init = (w: number, h: number) => {
    const anchorX = w * 0.5;
    const anchorY = h * 0.22;
    nodesRef.current = Array.from({ length: 9 }, (_, i) => ({
      x: anchorX,
      y: anchorY + i * 22,
      px: anchorX,
      py: anchorY + i * 22,
    }));
    fishRef.current = Array.from({ length: 5 }, () => ({
      x: Math.random() * w,
      y: h * 0.55 + Math.random() * h * 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.6,
      size: 12 + Math.random() * 10,
    }));
  };

  const draw = (ctx: Ctx, w: number, h: number, api: { pointer: () => { x: number; y: number } | null }, click: { get: () => { x: number; y: number } | null; clear: () => void }) => {
    if (!nodesRef.current.length) init(w, h);

    const nodes = nodesRef.current;
    const fish = fishRef.current;

    // air
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0b2740");
    grad.addColorStop(0.45, "#0e3a55");
    grad.addColorStop(1, "#06202f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 6; i++) {
      const y = h * 0.3 + i * 22;
      ctx.strokeStyle = `rgba(150,210,235,${0.05 + i * 0.012})`;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + performance.now() * 0.0014 + i) * 4);
      }
      ctx.stroke();
    }

    // ikan
    for (const f of fish) {
      f.phase += 0.02 * f.speed;
      f.x += 0.7 * f.speed;
      if (f.x > w + 40) f.x = -40;
      const y = f.y + Math.sin(f.phase) * 16;

      ctx.save();
      ctx.translate(f.x, y);
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.ellipse(0, 0, f.size, f.size * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-f.size, 0);
      ctx.lineTo(-f.size - 10, -8);
      ctx.lineTo(-f.size - 10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0b2740";
      ctx.beginPath();
      ctx.arc(f.size * 0.45, -2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // klik = lempar kail
    const c = click.get();
    if (c) {
      click.clear();
      const hook = nodes[nodes.length - 1];
      const dx = c.x - hook.x;
      const dy = c.y - hook.y;
      const d = Math.hypot(dx, dy) || 1;
      hook.px = hook.x - (dx / d) * 26;
      hook.py = hook.y - (dy / d) * 26;
      stateRef.current = "casting";
    }

    // verlet
    const anchorX = w * 0.5;
    const anchorY = h * 0.22;
    nodes[0].x = anchorX;
    nodes[0].y = anchorY;
    nodes[0].px = anchorX;
    nodes[0].py = anchorY;

    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      const vx = (n.x - n.px) * 0.98;
      const vy = (n.y - n.py) * 0.98;
      n.px = n.x;
      n.py = n.y;
      n.x += vx;
      n.y += vy + 0.55;
    }
    for (let it = 0; it < 6; it++) {
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1];
        const b = nodes[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - 22) / d;
        b.x -= dx * diff * 0.5;
        b.y -= dy * diff * 0.5;
        a.x += dx * diff * 0.5;
        a.y += dy * diff * 0.5;
      }
      for (let i = 1; i < nodes.length; i++) {
        nodes[i].y = Math.min(nodes[i].y, h - 8);
      }
    }

    // senar
    ctx.strokeStyle = "rgba(235,245,255,.85)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
    ctx.stroke();

    const hook = nodes[nodes.length - 1];

    // kail
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hook.x, hook.y + 5, 6, 0.15 * Math.PI, 1.35 * Math.PI);
    ctx.stroke();

    // tangkap ikan
    for (const f of fish) {
      const fy = f.y + Math.sin(f.phase) * 16;
      if (Math.hypot(f.x - hook.x, fy - hook.y) < f.size + 8) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        for (let i = 0; i < 14; i++) {
          splashRef.current.push({
            x: f.x,
            y: fy,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 5,
            life: 1,
          });
        }
        f.x = -40;
        f.y = h * 0.55 + Math.random() * h * 0.3;
        hook.px = hook.x;
        hook.py = hook.y - 18;
        stateRef.current = "idle";
      }
    }

    // splash
    for (let i = splashRef.current.length - 1; i >= 0; i--) {
      const p = splashRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life -= 0.02;
      if (p.life <= 0) {
        splashRef.current.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(190,235,255,${p.life})`;
      ctx.fillRect(p.x, p.y, 2.5, 2.5);
    }
    splashRef.current = splashRef.current.slice(-PARTICLE_BUDGET);

    // HUD
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "600 14px ui-sans-serif, system-ui";
    ctx.fillText(`TANGKAPAN ${scoreRef.current}`, 18, 30);
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.fillText("klik untuk melempar kail", 18, 50);
  };

  return <canvas ref={useCanvas(draw, init)} className="h-full w-full cursor-crosshair touch-none" />;
}

/* ------------------------------------------------------------------ */
/* 2. DOMINO — rantai rotasi + debu                                   */
/* ------------------------------------------------------------------ */

type Domino = { x: number; angle: number; vel: number; pushed: boolean };

function DominoMotif() {
  const listRef = useRef<Domino[]>([]);
  const dustRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number }[]>([]);
  const count = 16;

  const init = (w: number, h: number) => {
    void w;
    void h;
    listRef.current = Array.from({ length: count }, (_, i) => ({
      x: 60 + i * 44,
      angle: 0,
      vel: 0,
      pushed: false,
    }));
  };

  const draw = (ctx: Ctx, w: number, h: number, _api: unknown, click: { get: () => { x: number; y: number } | null; clear: () => void }) => {
    if (!listRef.current.length) init(w, h);
    const list = listRef.current;
    const baseY = h * 0.78;

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#101828");
    g.addColorStop(1, "#05070d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    ctx.moveTo(0, baseY + 2);
    ctx.lineTo(w, baseY + 2);
    ctx.stroke();

    const c = click.get();
    if (c) {
      click.clear();
      const first = list[0];
      first.pushed = true;
      first.vel = 0.28;
    }

    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (d.pushed) {
        d.vel += (1.2 - d.angle) * 0.06;
        d.vel *= 0.97;
        d.angle += d.vel;
        if (d.angle > 1.05) d.angle = 1.05;

        if (d.angle > 0.32 && i + 1 < list.length && !list[i + 1].pushed) {
          list[i + 1].pushed = true;
          list[i + 1].vel = 0.16;
        }
        if (d.angle > 0.5 && i % 2 === 0 && dustRef.current.length < PARTICLE_BUDGET) {
          dustRef.current.push({
            x: d.x + 12 + Math.random() * 10,
            y: baseY - 4,
            vx: (Math.random() - 0.2) * 1.4,
            vy: -Math.random() * 1.2,
            life: 1,
          });
        }
      }

      ctx.save();
      ctx.translate(d.x, baseY);
      ctx.rotate(d.angle);
      const hh = 74;
      const ww = 12;
      const grad = ctx.createLinearGradient(0, -hh, 0, 0);
      grad.addColorStop(0, d.pushed ? "#8fd3ff" : "#e6edf7");
      grad.addColorStop(1, d.pushed ? "#2f7fb5" : "#93a4bb");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(-ww / 2, -hh, ww, hh, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(10,20,35,.55)";
      ctx.beginPath();
      ctx.arc(0, -hh * 0.68, 1.8, 0, Math.PI * 2);
      ctx.arc(0, -hh * 0.4, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (let i = dustRef.current.length - 1; i >= 0; i--) {
      const p = dustRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.life -= 0.02;
      if (p.life <= 0) {
        dustRef.current.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(210,225,245,${p.life * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4 * p.life + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("klik untuk menjatuhkan domino pertama", 16, 26);

    if (list.every((d) => d.angle > 0.9)) {
      ctx.fillStyle = "#8fd3ff";
      ctx.font = "700 22px ui-sans-serif, system-ui";
      ctx.fillText("RANTAI PENUH!", 16, 58);
    }
  };

  return <canvas ref={useCanvas(draw, init)} className="h-full w-full cursor-pointer touch-none" />;
}

/* ------------------------------------------------------------------ */
/* 3. TATAP-HAP — spotlight + reticle zoom                            */
/* ------------------------------------------------------------------ */

type Target = { x: number; y: number; found: boolean; ring: number; shape: number };

function SpotMotif() {
  const targetsRef = useRef<Target[]>([]);
  const [found, setFound] = useState(0);

  const init = (w: number, h: number) => {
    targetsRef.current = Array.from({ length: 7 }, (_, i) => ({
      x: 60 + Math.random() * (w - 120),
      y: 60 + Math.random() * (h - 120),
      found: false,
      ring: 0,
      shape: i % 3,
    }));
  };

  const draw = (ctx: Ctx, w: number, h: number, api: { pointer: () => { x: number; y: number } | null }, click: { get: () => { x: number; y: number } | null; clear: () => void }) => {
    if (!targetsRef.current.length) init(w, h);
    const targets = targetsRef.current;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    // pola latar
    ctx.strokeStyle = "rgba(120,160,220,.10)";
    for (let x = 0; x < w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // objek
    for (const t of targets) {
      const color = t.found ? "#7ef0b0" : "#f2b6a0";
      ctx.fillStyle = color;
      if (t.shape === 0) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, 11, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.shape === 1) {
        ctx.fillRect(t.x - 10, t.y - 10, 20, 20);
      } else {
        ctx.beginPath();
        ctx.moveTo(t.x, t.y - 12);
        ctx.lineTo(t.x + 12, t.y + 9);
        ctx.lineTo(t.x - 12, t.y + 9);
        ctx.closePath();
        ctx.fill();
      }
      if (t.ring > 0) {
        ctx.strokeStyle = `rgba(126,240,176,${t.ring})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 14 + (1 - t.ring) * 34, 0, Math.PI * 2);
        ctx.stroke();
        t.ring -= 0.025;
      }
    }

    // klik
    const c = click.get();
    const p = api.pointer();
    const spot = c || p;
    if (c) click.clear();

    if (c) {
      for (const t of targets) {
        if (!t.found && Math.hypot(t.x - c.x, t.y - c.y) < 26) {
          t.found = true;
          t.ring = 1;
          setFound(targets.filter((x) => x.found).length);
          break;
        }
      }
    }

    // kegelapan + lubang sorot
    const sx = spot?.x ?? w / 2;
    const sy = spot?.y ?? h / 2;
    const r = 132;
    const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, r);
    grad.addColorStop(0, "rgba(4,8,16,0)");
    grad.addColorStop(0.72, "rgba(4,8,16,.55)");
    grad.addColorStop(1, "rgba(4,8,16,.95)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // reticle
    ctx.strokeStyle = "rgba(150,220,255,.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - 48, sy);
    ctx.lineTo(sx - 22, sy);
    ctx.moveTo(sx + 22, sy);
    ctx.lineTo(sx + 48, sy);
    ctx.moveTo(sx, sy - 48);
    ctx.lineTo(sx, sy - 22);
    ctx.moveTo(sx, sy + 22);
    ctx.lineTo(sx, sy + 48);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(`DITEMUKAN ${found}/${targets.length}`, 16, 26);
  };

  return <canvas ref={useCanvas(draw, init)} className="h-full w-full cursor-none touch-none" />;
}

/* ------------------------------------------------------------------ */
/* Halaman                                                            */
/* ------------------------------------------------------------------ */

export default function MotionLabPage() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(reducedMotion());
  }, []);

  return (
    <main className="min-h-screen bg-[#05070d] px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-black">Laboratorium Animasi Orisinil</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tiga bahasa gerak yang tidak memakai aset atau timing papaninteraktif.com.
          {reduce ? " Prefers-reduced-motion aktif: gerak diperlambat." : ""}
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <header className="flex items-baseline justify-between px-4 py-3">
              <h2 className="text-sm font-bold">1 · Mancing — kail, senar verlet, ikan sinusoidal</h2>
              <span className="text-[11px] text-slate-400">klik area</span>
            </header>
            <div className="h-[320px]">
              <FishingMotif />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <header className="flex items-baseline justify-between px-4 py-3">
              <h2 className="text-sm font-bold">2 · Domino — rantai rotasi + debu</h2>
              <span className="text-[11px] text-slate-400">klik area</span>
            </header>
            <div className="h-[320px]">
              <DominoMotif />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 lg:col-span-2">
            <header className="flex items-baseline justify-between px-4 py-3">
              <h2 className="text-sm font-bold">3 · Tatap-Hap — spotlight + reticle</h2>
              <span className="text-[11px] text-slate-400">gerakkan kursor, klik objek</span>
            </header>
            <div className="h-[320px]">
              <SpotMotif />
            </div>
          </section>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Token gerak: 120/240/420 ms, ease-out (.2,.9,.25,1), pegas k=120 c=18, budget partikel 180.
        </p>
      </div>
    </main>
  );
}
