/**
 * Mesin render arena Adu Tarik (v3 - pass realisme).
 *
 *  - Tali memakai katenari (cosh) + gelombang tegangan yang menjalar.
 *  - Tali berbayang (badan, cahaya atas, serat) + simpul + bayangan di tanah.
 *  - Adegan: matahari + glow, bukit tiga lapis berkabut, tanah bertekstur,
 *    rumput berayun, rumput depan, vignette.
 *  - Karakter: bayangan kontak, napas, debu kaki.
 *  - Pita penanda bergerak seperti kain.
 */

import { CHARACTERS, getFrameCrop } from "./sprites";
import { ANCHORS } from "./anchors";
import arenaBg from "../assets/sprites/dino-arena-bg.jpg";

/** Pelat background arena (desain Google Flow, Log 28): tepi atas lapangannya
 *  di fraksi 0.6868 tinggi gambar; digambar sejajar garis tanah arena.
 *  Bila belum termuat, adegan prosedural lama dipakai sebagai cadangan. */
const BG_FIELD_TOP = 0.6868;
import type { GameMode } from "./logic";
import { PARTICLE_BUDGET, clamp } from "../lib-pendamping/motion-tokens";

export type Side = "p1" | "p2";

export interface FloatEnt {
  side: Side;
  text: string;
  tag: string | null;
  tone: "good" | "bad";
  bornAt: number;
}

export interface ArenaView {
  rope: { current: number };
  frame: { current: Record<Side, number> };
  shake: { current: number };
  result: { current: "p1" | "p2" | "draw" | null };
  mode: GameMode;
  winLimit: number;
  maxOffset: number;
  leftChars: string[];
  rightChars: string[];
  images: { current: Record<string, HTMLImageElement> };
  power: { current: Record<Side, number> };
  floaters: { current: FloatEnt[] };
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
  color: string;
  grav: number;
}

export interface ArenaHandle {
  stop: () => void;
  emitDust: (side: Side, strength?: number) => void;
  emitConfetti: () => void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function runArena(canvas: HTMLCanvasElement, wrap: HTMLElement, view: ArenaView): ArenaHandle {
  const ctx = canvas.getContext("2d");
  const bgImg = new Image();
  bgImg.src = arenaBg.src;
  if (!ctx) return { stop: () => {}, emitDust: () => {}, emitConfetti: () => {} };

  let w = 0;
  let h = 0;
  let raf = 0;
  const particles: Particle[] = [];

  let shown = 0;
  let vel = 0;
  let ribbon = 0;
  let ribbonVel = 0;
  let waveAmp = 0;
  let wavePhase = 0;
  let flash = 0;
  let dustTimer = 0;
  let resultStart = -1;
  let dragP1 = 0;
  let dragP2 = 0;
  let dragE = 0;

  const prevFrame: Record<Side, number> = { p1: 0, p2: 0 };
  const mix: Record<Side, number> = { p1: 0, p2: 0 };
  const seen: Record<Side, number> = { p1: -1, p2: -1 };

  const clouds = [
    { x: 0.08, y: 0.15, s: 1.3, v: 0.0035 },
    { x: 0.44, y: 0.1, s: 0.85, v: 0.0025 },
    { x: 0.72, y: 0.19, s: 1.1, v: 0.0018 },
    { x: 0.92, y: 0.12, s: 0.7, v: 0.0022 },
  ];

  const resize = () => {
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const ro = new ResizeObserver(() => {
    resize();
    buildScene();
  });
  ro.observe(wrap);

  const isNarrow = () => w > 0 && h > 0 && w / h < 1.35;
  // Log 31–32 (perintah user 28 Okt 22:11 & 22:18): maskot dikecilkan dari
  // ukuran semula supaya formasi punya ruang gerak lega untuk animasi
  // tarik-menarik — batas jepit travel di feetOf dihitung dari ukuran sel,
  // jadi sel lebih kecil = tali bisa berpindah lebih jauh tanpa menyeret
  // maskot keluar arena. Log 32 menurunkannya lagi 0,78 -> 0,62 atas
  // permintaan user ("kecilin lagi biar lega").
  const CHAR_SCALE = 0.62;
  const cellOf = () => CHAR_SCALE * (isNarrow() ? Math.min(h * 0.74, w * 0.46) : Math.min(h * 0.68, w * 0.27));

  const feetOf = (side: Side, index: number, cell: number) => {
    // Log 33 (perintah user 28 Okt 22:21): tali dipendekkan — kedua tim ditarik
    // lebih dekat ke tengah (spread lebar 0,31 -> 0,37) supaya formasi tidak
    // berjauhan dan setiap tarikan terbaca sebagai langkah mundur yang jelas.
    const spread = isNarrow() ? 0.24 : 0.37;
    // Jarak tempuh formasi dibatasi: tali boleh berpindah, tapi tidak sampai menyeret
    // maskot paling belakang keluar arena. Jepit dihitung dari posisi maskot belakang.
    const travel = Math.max(0, w * spread - cell * 0.94 - 6);
    const shift = clamp((shown / view.maxOffset) * (w * 0.065), -travel, travel);
    const base = side === "p1" ? w * spread : w * (1 - spread);
    const dir = side === "p1" ? -1 : 1;
    const drag = side === "p1" ? dragP1 : dragP2;
    return { x: base + shift + dir * index * cell * 0.54 + drag, y: h * 0.82 };
  };

  const handPoint = (id: string, side: Side, feetX: number, feetY: number, cell: number, lean: number, bob: number) => {
    const a = ANCHORS[id] ?? { side: "R" as const, top: 0.5, frames: [{ x: 0.5, y: 0.74 }] };
    const wantSide = side === "p1" ? "R" : "L";
    const flip = a.side !== wantSide;
    const last = a.frames.length - 1;
    const curF = a.frames[Math.min(Math.max(seen[side], 0), last)] ?? a.frames[0];
    const prevF = a.frames[Math.min(Math.max(prevFrame[side], 0), last)] ?? curF;
    const m = clamp(mix[side], 0, 1);
    const fx = curF.x * (1 - m) + prevF.x * m;
    const fy = curF.y * (1 - m) + prevF.y * m;
    const hx = flip ? 1 - fx : fx;
    const lx = -cell / 2 + hx * cell;
    const ly = -cell + fy * cell - bob;
    const cos = Math.cos(lean);
    const sin = Math.sin(lean);
    return { x: feetX + lx * cos - ly * sin, y: feetY + lx * sin + ly * cos, flip };
  };

  // Titik tangan kedua (pemain belakang dua tangan): geometri sama dengan handPoint,
  // memakai rearFrames. Null bila karakter tidak punya tangan kedua terpisah.
  const rearPoint = (id: string, side: Side, feetX: number, feetY: number, cell: number, lean: number, bob: number) => {
    const a = ANCHORS[id];
    if (!a || !a.rearFrames || a.rearFrames.length === 0) return null;
    const wantSide = side === "p1" ? "R" : "L";
    const flip = a.side !== wantSide;
    const last = a.rearFrames.length - 1;
    const curF = a.rearFrames[Math.min(Math.max(seen[side], 0), last)] ?? a.rearFrames[0];
    const prevF = a.rearFrames[Math.min(Math.max(prevFrame[side], 0), last)] ?? curF;
    const m = clamp(mix[side], 0, 1);
    const fx = curF.x * (1 - m) + prevF.x * m;
    const fy = curF.y * (1 - m) + prevF.y * m;
    const hx = flip ? 1 - fx : fx;
    const lx = -cell / 2 + hx * cell;
    const ly = -cell + fy * cell - bob;
    const cos = Math.cos(lean);
    const sin = Math.sin(lean);
    return { x: feetX + lx * cos - ly * sin, y: feetY + lx * sin + ly * cos };
  };

  const emitDust = (side: Side, strength = 1) => {
    const cell = cellOf();
    const feet = feetOf(side, 0, cell);
    const n = Math.round(11 * strength);
    for (let i = 0; i < n && particles.length < PARTICLE_BUDGET; i++) {
      particles.push({
        x: feet.x + (Math.random() - 0.5) * cell * 0.5,
        y: feet.y - 1,
        vx: (side === "p1" ? 1 : -1) * (25 + Math.random() * 95),
        vy: -(18 + Math.random() * 60),
        life: 1,
        r: 1.1 + Math.random() * 2.4,
        color: "226,213,182",
        grav: 300,
      });
    }
    waveAmp = Math.min(1.2, waveAmp + 0.55 * strength);
  };

  const emitConfetti = () => {
    const colors = ["255,209,102", "126,240,176", "143,211,255", "242,166,196", "255,255,255", "255,183,94"];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * w,
        y: h * 0.08 + Math.random() * h * 0.1,
        vx: (Math.random() - 0.5) * 150,
        vy: 25 + Math.random() * 70,
        life: 1,
        r: 1.8 + Math.random() * 3.2,
        color: colors[i % colors.length],
        grav: 190,
      });
    }
    flash = 0.3;
  };

  const CAT_K = 1.7;
  const catC = Math.cosh(CAT_K * 0.5);
  const catW = (u: number) => (Math.cosh(CAT_K * (u - 0.5)) - catC) / (1 - catC);

  const ropeAt = (u: number, x0: number, y0: number, x1: number, y1: number, sag: number, now: number) => {
    const base = lerp(y0, y1, u) + sag * catW(u);
    const travel = Math.sin(u * Math.PI * 3 - wavePhase) * Math.sin(Math.PI * u) * waveAmp * 7;
    const idle = Math.sin(now * 0.004 + u * 6) * 1.2 * (1 - Math.min(1, Math.abs(shown) / view.maxOffset));
    return { x: lerp(x0, x1, u), y: base + travel + idle };
  };

  const drawCloud = (cx: number, cy: number, s: number) => {
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 1.75, s * 0.72, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + s * 1.05, cy + s * 0.12, s * 1.05, s * 0.55, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - s * 1.0, cy + s * 0.16, s * 0.85, s * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(150,175,195,.30)";
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.2, cy + s * 0.5, s * 1.4, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  /* ------------------------------ gunung 3D ------------------------------ */

  const mulberry32 = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  interface Peak {
    x: number;
    w: number;
    h: number;
    snow: number;
    seed: number;
  }
  interface MtnLayer {
    base: number;
    peaks: Peak[];
    light: string;
    dark: string;
    snow: string;
    haze: number;
    ridge: string;
  }

  const scene: { mountains: MtnLayer[]; foothills: [number, number, number, string][] } = {
    mountains: [],
    foothills: [],
  };

  const buildScene = () => {
    const rnd = mulberry32(20261021);
    const groundY = h * 0.82;
    const mk = (n: number, baseOff: number, hmin: number, hmax: number, wmin: number, wmax: number, layer: Omit<MtnLayer, "peaks" | "base">) => {
      const peaks: Peak[] = [];
      for (let i = 0; i < n; i++) {
        const ww = w * (wmin + rnd() * (wmax - wmin));
        peaks.push({
          x: ((i + 0.5) / n) * w + (rnd() - 0.5) * w * 0.22,
          w: ww,
          h: h * (hmin + rnd() * (hmax - hmin)),
          snow: 0.18 + rnd() * 0.12,
          seed: Math.floor(rnd() * 1e6),
        });
      }
      peaks.sort((a, b) => a.h - b.h);
      return { base: groundY + baseOff, peaks, ...layer } as MtnLayer;
    };

    scene.mountains = [
      mk(4, 4, 0.26, 0.42, 0.3, 0.46, {
        light: "#b6cddd",
        dark: "#93aec2",
        snow: "#eef5fa",
        haze: 0.55,
        ridge: "rgba(255,255,255,.35)",
      }),
      mk(3, 0, 0.34, 0.5, 0.34, 0.5, {
        light: "#8ba9b8",
        dark: "#63808f",
        snow: "#f3f8fb",
        haze: 0.28,
        ridge: "rgba(255,255,255,.45)",
      }),
      mk(3, -6, 0.28, 0.42, 0.32, 0.46, {
        light: "#6d8b83",
        dark: "#48635c",
        snow: "#e8f1f2",
        haze: 0,
        ridge: "rgba(255,255,255,.3)",
      }),
    ];

    scene.foothills = [
      [0.16, 0.4, 0.1, "rgba(120,164,124,.5)"],
      [0.62, 0.46, 0.08, "rgba(98,146,108,.55)"],
      [0.9, 0.36, 0.07, "rgba(84,124,92,.5)"],
    ];
  };

  const drawMountain = (m: Peak, layer: MtnLayer, now: number) => {
    const base = layer.base;
    const hw = m.w / 2;
    const top = base - m.h;
    void now;

    // badan gunung (facet terang menghadap matahari di kanan)
    const body = ctx.createLinearGradient(m.x - hw, top, m.x + hw, base);
    body.addColorStop(0, layer.dark);
    body.addColorStop(0.55, layer.light);
    body.addColorStop(1, layer.dark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(m.x - hw, base);
    ctx.lineTo(m.x, top);
    ctx.lineTo(m.x + hw, base);
    ctx.closePath();
    ctx.fill();

    // bidang gelap (sisi bayangan) untuk kesan 3D
    const rnd = mulberry32(m.seed)();
    const shadeX = m.x + hw * (0.1 + rnd * 0.18);
    ctx.fillStyle = "rgba(38,58,66,.22)";
    ctx.beginPath();
    ctx.moveTo(m.x, top);
    ctx.lineTo(m.x + hw, base);
    ctx.lineTo(shadeX, base);
    ctx.closePath();
    ctx.fill();

    // punggung terang
    ctx.strokeStyle = layer.ridge;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(m.x, top);
    ctx.lineTo(m.x - hw * 0.96, base);
    ctx.stroke();

    // salju di puncak (zigzag)
    const snowH = m.h * m.snow;
    const steps = 7;
    ctx.fillStyle = layer.snow;
    ctx.beginPath();
    ctx.moveTo(m.x, top);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const y = top + snowH * t * (0.75 + ((m.seed + i * 37) % 10) / 26);
      ctx.lineTo(m.x - hw * t, y);
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const y = top + snowH * t * (0.8 + ((m.seed + i * 53) % 10) / 28);
      ctx.lineTo(m.x + hw * t, y);
    }
    ctx.closePath();
    ctx.fill();

    // bayangan dasar gunung
    const sh = ctx.createLinearGradient(0, base - 2, 0, base + 10);
    sh.addColorStop(0, "rgba(40,60,50,.18)");
    sh.addColorStop(1, "rgba(40,60,50,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(m.x - hw, base - 2, m.w, 12);
  };

  const drawChar = (
    id: string,
    side: Side,
    feetX: number,
    feetY: number,
    cell: number,
    lean: number,
    squash: number,
    bob: number,
    dull: boolean,
  ) => {
    const conf = CHARACTERS[id];
    const img = view.images.current[id];
    if (!conf) return;
    const a = ANCHORS[id];
    const wantSide = side === "p1" ? "R" : "L";
    const flip = a ? a.side !== wantSide : false;

    ctx.save();
    ctx.translate(feetX, feetY);
    const shW = cell * 0.34;
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, shW);
    grad.addColorStop(0, "rgba(24,44,26,.30)");
    grad.addColorStop(0.6, "rgba(24,44,26,.14)");
    grad.addColorStop(1, "rgba(24,44,26,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, shW, cell * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(feetX, feetY - bob);
    ctx.rotate(lean);
    ctx.scale(1 + squash * 0.28, 1 - squash * 0.2);

    const frame = view.frame.current[side];
    if (seen[side] !== frame) {
      prevFrame[side] = seen[side] < 0 ? frame : seen[side];
      mix[side] = 1;
      seen[side] = frame;
    }

    const paint = (idx: number, alpha: number) => {
      if (alpha <= 0.01) return;
      ctx.globalAlpha = alpha;
      if (img && img.naturalWidth > 0) {
        const crop = getFrameCrop(idx, img.naturalWidth, img.naturalHeight, conf.cols, conf.rows);
        ctx.save();
        if (dull) ctx.filter = "saturate(0.5) brightness(0.93)";
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, -cell / 2, -cell, cell, cell);
        ctx.restore();
      } else {
        ctx.fillStyle = conf.accent;
        ctx.beginPath();
        ctx.ellipse(0, -cell * 0.3, cell * 0.22, cell * 0.27, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, -cell * 0.66, cell * 0.14, cell * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const m = clamp(mix[side], 0, 1);
    if (m > 0.001 && prevFrame[side] !== frame) {
      paint(prevFrame[side], m);
      paint(frame, 1 - m);
    } else {
      paint(frame, 1);
    }

    if (frame === 3) {
      const d = side === "p1" ? -1 : 1;
      ctx.strokeStyle = "rgba(255,255,255,.4)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const yy = -cell * (0.3 + i * 0.13);
        ctx.beginPath();
        ctx.moveTo(d * cell * 0.42, yy);
        ctx.lineTo(d * cell * (0.6 + i * 0.06), yy + 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  buildScene();

  let last = performance.now();

  const loop = (now: number) => {
    const dt = Math.min(48, now - last);
    last = now;

    const prevVel = vel;
    // Log 33: pegas dilunakkan (kekakuan 0,1 -> 0,045; redaman 0,8 -> 0,86)
    // supaya sesudah jawaban benar formasi mundur PERLAHAN langkah demi
    // langkah, bukan menyentak sampai — sesuai permintaan user 28 Okt 22:21.
    vel = (vel + (view.rope.current - shown) * 0.045) * 0.86;
    shown += vel;

    if (Math.abs(vel - prevVel) > 3) waveAmp = Math.min(1.2, waveAmp + Math.abs(vel - prevVel) / 90);
    waveAmp *= 0.94;
    wavePhase += dt * 0.018;

    ribbonVel = (ribbonVel - ribbon * 0.05 - vel * 0.035) * 0.9;
    ribbon += ribbonVel;

    for (const s of ["p1", "p2"] as Side[]) {
      if (mix[s] > 0) mix[s] = Math.max(0, mix[s] - dt / 150);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      p.vy += p.grav * (dt / 1000);
      p.life -= dt / 1000;
      if (p.life <= 0 || p.y > h + 24) particles.splice(i, 1);
    }
    flash = Math.max(0, flash - dt / 400);

    const tension = clamp(Math.abs(shown) / view.maxOffset, 0, 1);
    const cell = cellOf();
    const groundY = h * 0.82;
    const shift = (shown / view.maxOffset) * (w * 0.18);

    const res: "p1" | "p2" | "draw" | null = view.result.current;
    if (res && resultStart < 0) resultStart = now;
    if (!res) resultStart = -1;
    const dragP = res ? clamp((now - resultStart) / 1400, 0, 1) : 0;
    dragE = 1 - Math.pow(1 - dragP, 3);
    const dirSign = res === "p1" ? -1 : res === "p2" ? 1 : 0;
    const loserDrag = isNarrow() ? 0.05 : 0.1;
    dragP1 = dirSign === 0 ? 0 : (dirSign < 0 ? -w * 0.02 : w * loserDrag) * dragE;
    dragP2 = dirSign === 0 ? 0 : (dirSign < 0 ? -w * loserDrag : w * 0.02) * dragE;

    ctx.save();
    const sa = view.shake.current;
    if (sa > 0.2) ctx.translate((Math.random() - 0.5) * sa * 2, (Math.random() - 0.5) * sa * 2);

    const bgReady = bgImg.naturalWidth > 0;
    if (bgReady) {
      const iw = bgImg.naturalWidth;
      const ih = bgImg.naturalHeight;
      const sc = Math.max(w / iw, groundY / (BG_FIELD_TOP * ih));
      const dw = iw * sc;
      const dh = ih * sc;
      ctx.drawImage(bgImg, (w - dw) / 2, groundY - BG_FIELD_TOP * dh, dw, dh);
    }
    if (!bgReady) {
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, "#8fc9e6");
    sky.addColorStop(0.55, "#cfe8de");
    sky.addColorStop(1, "#c3e0b4");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, groundY + 2);

    const sunX = w * 0.84;
    const sunY = h * 0.14;
    const sunR = Math.max(26, h * 0.06);
    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 5);
    sunGlow.addColorStop(0, "rgba(255,246,196,.95)");
    sunGlow.addColorStop(0.25, "rgba(255,236,170,.35)");
    sunGlow.addColorStop(1, "rgba(255,236,170,0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, w, groundY);
    ctx.fillStyle = "rgba(255,252,224,.95)";
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    for (const c of clouds) {
      c.x = (c.x + c.v * (dt / 1000) * 8) % 1.15;
      drawCloud(c.x * w, c.y * groundY, c.s * h * 0.042);
    }

    // ---- gunung 3D (tiga lapis, facet terang/gelap + salju) ----
    for (const layer of scene.mountains) {
      for (const m of layer.peaks) {
        drawMountain(m, layer, now);
      }
      if (layer.haze) {
        const hz = ctx.createLinearGradient(0, layer.base - h * 0.16, 0, layer.base);
        hz.addColorStop(0, "rgba(255,255,255,0)");
        hz.addColorStop(1, `rgba(255,255,255,${layer.haze})`);
        ctx.fillStyle = hz;
        ctx.fillRect(0, layer.base - h * 0.16, w, h * 0.16);
      }
    }
    // perbukitan kaki (menyatukan gunung dengan tanah)
    for (const [cx, cw, ch, col] of scene.foothills) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(w * cx, groundY, w * cw, h * ch, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    const soil = ctx.createLinearGradient(0, groundY, 0, h);
    soil.addColorStop(0, "#78ac67");
    soil.addColorStop(0.35, "#6aa05c");
    soil.addColorStop(1, "#4e7f45");
    ctx.fillStyle = soil;
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = "rgba(0,0,0,.14)";
    ctx.fillRect(0, groundY, w, 3);

    for (let i = 0; i < 90; i++) {
      const px = (((i * 173) % 100) / 100) * w;
      const py = groundY + 10 + (((i * 71) % 100) / 100) * (h - groundY - 12);
      const rr = 1 + ((i * 37) % 5) * 0.6;
      ctx.fillStyle = i % 4 === 0 ? "rgba(90,120,70,.35)" : "rgba(48,74,40,.22)";
      ctx.beginPath();
      ctx.ellipse(px, py, rr * 1.6, rr * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 90; i++) {
      const gx = (((i * 137) % 100) / 100) * w;
      const baseY = groundY + 4 + (((i * 53) % 100) / 100) * (h - groundY - 6);
      const sway = Math.sin(now * 0.0016 + gx * 0.02) * 2.4;
      const len = 4 + ((i * 29) % 7);
      ctx.strokeStyle = i % 3 === 0 ? "rgba(255,255,255,.20)" : "rgba(58,96,48,.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(gx, baseY);
      ctx.quadraticCurveTo(gx + sway * 0.5, baseY - len * 0.6, gx + sway, baseY - len);
      ctx.stroke();
    }
    }

    for (const zx of [0.26, 0.74]) {
      const X = w * zx + shift * 0.35;
      const near = clamp(1 - Math.abs(Math.abs(shown) - view.winLimit * 0.75) / (view.winLimit * 0.5), 0, 1);
      ctx.save();
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -now * 0.01;
      ctx.strokeStyle = near > 0.45 ? `rgba(255,238,140,${0.6 + 0.4 * near})` : "rgba(255,255,255,.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(X, h * 0.22);
      ctx.lineTo(X, groundY + 2);
      ctx.stroke();
      ctx.restore();
      if (near > 0.3) {
        const glow = ctx.createLinearGradient(X - 12, 0, X + 12, 0);
        glow.addColorStop(0, "rgba(255,238,140,0)");
        glow.addColorStop(0.5, `rgba(255,238,140,${0.1 * near})`);
        glow.addColorStop(1, "rgba(255,238,140,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(X - 12, h * 0.22, 24, groundY - h * 0.22);
      }
    }

    // ---- garis tengah: acuan kesejajaran ----
    ctx.save();
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -now * 0.004;
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.1);
    ctx.lineTo(w / 2, groundY + 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 9, h * 0.1);
    ctx.lineTo(w / 2 + 9, h * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.1, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fill();
    ctx.restore();

    const leanBase = clamp(shown / view.maxOffset, -1, 1);
    const squash = clamp(Math.abs(vel) / 45, 0, 0.45);
    const breathe = Math.sin(now * 0.0028) * cell * 0.008;

    const placed: Record<
      Side,
      {
        id: string;
        x: number;
        y: number;
        lean: number;
        scale: number;
        bob: number;
        dull: boolean;
        hand: ReturnType<typeof handPoint>;
        rear: ReturnType<typeof rearPoint>;
      }[]
    > = { p1: [], p2: [] };

    (["p1", "p2"] as Side[]).forEach((side) => {
      const ids = side === "p1" ? view.leftChars : view.rightChars;
      ids.forEach((id, i) => {
        const feet = feetOf(side, i, cell);
        const dir = side === "p1" ? -1 : 1;
        const isLoser = res ? (res === "p1" ? side === "p2" : side === "p1") : false;
        const isWinner = res ? (res === "p1" ? side === "p1" : side === "p2") : false;
        const dragLean = (isLoser ? (res === "p1" ? -1 : 1) * 0.34 : 0) + (isWinner ? (res === "p1" ? 1 : -1) * 0.1 : 0);
        const lean = leanBase * dir * -0.12 + dir * -0.015 + dragLean * dragE;
        const scale = i === 0 ? cell : cell * 1.07;
        // Log 34 — bahasa tubuh hasil akhir: pemenang melompat-lompat kecil
        // merayakan (hop masuk ke bob supaya tangan tetap menempel di tali),
        // yang kalah diredupkan warnanya (dull) sebagai tanda lesu.
        const decided = res === "p1" || res === "p2";
        const hop = decided && res === side ? Math.abs(Math.sin(now * 0.012 + i * 0.9)) * cell * 0.05 * dragE : 0;
        const dull = decided && res !== side;
        const bob = breathe * (i === 0 ? 1 : 0.8) + hop;
        const hand = handPoint(id, side, feet.x, feet.y, scale, lean, bob);
        const rear = rearPoint(id, side, feet.x, feet.y, scale, lean, bob);
        placed[side].push({ id, x: feet.x, y: feet.y, lean, scale, bob, dull, hand, rear });
      });
    });

    const lf = placed.p1[0];
    const rf = placed.p2[0];
    const x0 = lf.hand.x + 4;
    const y0 = lf.hand.y;
    let x1 = rf.hand.x - 4;
    const y1 = rf.hand.y;
    const sag = (7 + 9 * (1 - tension)) * Math.max(0.7, h / 430);

    // jaga tali tidak terbalik walau yang kalah terseret jauh
    const minGap = Math.max(26, cell * 0.12);
    if (x1 - x0 < minGap) x1 = x0 + minGap;

    // diagnostik: posisi ujung tali (untuk uji kesejajaran)
    if (canvas.dataset) {
      canvas.dataset.rope = `${x0.toFixed(1)},${x1.toFixed(1)},${y0.toFixed(1)},${y1.toFixed(1)}`;
      canvas.dataset.width = String(Math.round(w));
      canvas.dataset.result = view.result.current ?? "";
      canvas.dataset.groundY = String(Math.round(groundY));
      canvas.dataset.cell = String(Math.round(cell));
      canvas.dataset.power = `${view.power.current.p1},${view.power.current.p2}`;
    }

    ctx.save();
    const shMid = ropeAt(0.5, x0, y0, x1, y1, sag, now);
    const shGrad = ctx.createRadialGradient(shMid.x, groundY + 4, 2, shMid.x, groundY + 4, w * 0.3);
    shGrad.addColorStop(0, "rgba(30,48,28,.22)");
    shGrad.addColorStop(1, "rgba(30,48,28,0)");
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.ellipse(shMid.x, groundY + 4, w * 0.28, cell * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ---- segmen tali per tim: tangan maskot belakang -> tangan maskot depan ----
    // AKTIF (Log 26): sprite adalah gambar ulang TANPA tali lukisan; seluruh tali digambar
    // program sebagai SATU tali per tim yang melewati semua kepalan.
    const segStrokes: [number, string][] = [
      [Math.max(7.5, h * 0.018), "#7a4e24"],
      [Math.max(5.5, h * 0.013), "#b98d54"],
      [Math.max(2.5, h * 0.006), "rgba(238,210,160,.9)"],
    ];
    let segCount = 0;
    for (const side of ["p1", "p2"] as Side[]) {
      const back = placed[side][1];
      const front = placed[side][0];
      if (!back || !front) continue;
      segCount++;
      const bsag = sag * 0.35;
      // tali dari maskot belakang berhenti di tangan KEDUA maskot depan bila ada,
      // lalu diteruskan segmen pendek ke kepalan depannya (dua tangan untuk semua)
      const endPt = front.rear ?? front.hand;
      for (const [lw, col] of segStrokes) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const p = ropeAt(i / 24, back.hand.x, back.hand.y, endPt.x, endPt.y, bsag, now);
          const off = col.startsWith("rgba") ? -lw * 0.22 : 0;
          if (i === 0) {
            ctx.moveTo(p.x, p.y + off);
          } else {
            ctx.lineTo(p.x, p.y + off);
          }
        }
        ctx.stroke();
      }
      // tali dari tangan kedua maskot belakang ke kepalan utamanya (dua tangan memegang tali yang sama)
      if (back.rear) {
        const rsag = sag * 0.2;
        for (const [lw, col] of segStrokes) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.beginPath();
          for (let i = 0; i <= 12; i++) {
            const p = ropeAt(i / 12, back.rear.x, back.rear.y, back.hand.x, back.hand.y, rsag, now);
            const off = col.startsWith("rgba") ? -lw * 0.22 : 0;
            if (i === 0) {
              ctx.moveTo(p.x, p.y + off);
            } else {
              ctx.lineTo(p.x, p.y + off);
            }
          }
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(96,60,30,.96)";
        ctx.beginPath();
        ctx.arc(back.rear.x, back.rear.y, Math.max(5, cell * 0.028), 0, Math.PI * 2);
        ctx.fill();
      }
      // simpul di kepalan maskot belakang (di bawah sprite: mengintip di tepi kepalan)
      ctx.fillStyle = "rgba(96,60,30,.96)";
      ctx.beginPath();
      ctx.arc(back.hand.x, back.hand.y, Math.max(5.5, cell * 0.032), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,230,190,.4)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(back.hand.x, back.hand.y, Math.max(5.5, cell * 0.032) - 2, -0.7, 2.1);
      ctx.stroke();
      // CATATAN Log 29: segmen tangan-kedua maskot DEPAN digambar SETELAH maskot
      // (lihat lintasan sesudah gambar karakter). Dulu digambar di sini — tertutup
      // badan maskot depan sendiri, sehingga tangan keduanya terlihat menggenggam
      // angin (keluhan user 28 Okt 13:58). Simpul TIDAK ikut dipindah ke atas:
      // cakram di atas kepalan kecil menutupi kepalannya (terlihat seperti bola).
    }
    if (canvas.dataset) canvas.dataset.segs = String(segCount);

    const strokes: [number, string][] = [
      [Math.max(7.5, h * 0.018), "#7a4e24"],
      [Math.max(5.5, h * 0.013), "#b98d54"],
      [Math.max(2.5, h * 0.006), "rgba(238,210,160,.9)"],
    ];
    for (const [lw, col] of strokes) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const p = ropeAt(i / 40, x0, y0, x1, y1, sag, now);
        const off = col.startsWith("rgba") ? -lw * 0.22 : 0;
        if (i === 0) {
          ctx.moveTo(p.x, p.y + off);
        } else {
          ctx.lineTo(p.x, p.y + off);
        }
      }
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(58,34,14,.16)";
    ctx.lineWidth = 1.5;
    for (let i = 2; i < 38; i += 2) {
      const a = ropeAt(i / 40, x0, y0, x1, y1, sag, now);
      const b = ropeAt((i + 0.6) / 40, x0, y0, x1, y1, sag, now);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 2.6);
      ctx.lineTo(b.x, b.y + 2.6);
      ctx.stroke();
    }

    for (const [hx, hy] of [
      [x0, y0],
      [x1, y1],
    ]) {
      ctx.fillStyle = "rgba(96,60,30,.96)";
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(5.5, cell * 0.032), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,230,190,.4)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(5.5, cell * 0.032) - 2, -0.7, 2.1);
      ctx.stroke();
    }

    const midP = ropeAt(0.5, x0, y0, x1, y1, sag, now);
    const rl = Math.max(20, h * 0.055);
    ctx.save();
    ctx.translate(midP.x, midP.y);
    ctx.rotate(ribbon * 0.6 + shown * 0.0015);
    const segments = 3;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const wave = Math.sin(now * 0.006 - i * 0.9 + ribbon) * (3 + i * 2.5);
      ctx.beginPath();
      ctx.moveTo(-6 + wave * 0.3, t0 * rl);
      ctx.lineTo(6 + wave * 0.3, t0 * rl);
      ctx.lineTo(6 + wave * 0.5, t1 * rl);
      ctx.lineTo(-6 + wave * 0.5, t1 * rl);
      ctx.closePath();
      ctx.fillStyle = i === segments - 1 ? "#a52a30" : "#d84046";
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.12)";
      ctx.fillRect(-6 + wave * 0.3, t0 * rl, 4, (t1 - t0) * rl);
    }
    ctx.fillStyle = "#f4e6c8";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,80,40,.6)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 6, -0.9, 1.6);
    ctx.stroke();
    ctx.restore();

    for (const side of ["p2", "p1"] as Side[]) {
      const list = [...placed[side]].reverse();
      for (const c of list) drawChar(c.id, side, c.x, c.y, c.scale, c.lean, squash, c.bob, c.dull);
    }

    // ---- Log 29: segmen tangan kedua maskot depan DI ATAS sprite ----
    // Hanya segmennya (tanpa cakram simpul), digambar sesudah karakter, supaya
    // tali TERLIHAT menyambung dari kepalan kedua ke kepalan depan maskot depan —
    // tidak tertelan badannya sendiri seperti sebelumnya.
    for (const side of ["p1", "p2"] as Side[]) {
      const front = placed[side][0];
      if (!front || !front.rear) continue;
      const fsag = sag * 0.2;
      for (const [lw, col] of segStrokes) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const p = ropeAt(i / 12, front.rear.x, front.rear.y, front.hand.x, front.hand.y, fsag, now);
          const off = col.startsWith("rgba") ? -lw * 0.22 : 0;
          if (i === 0) {
            ctx.moveTo(p.x, p.y + off);
          } else {
            ctx.lineTo(p.x, p.y + off);
          }
        }
        ctx.stroke();
      }
    }

    // ---- HUD ala defn: pil kekuatan di atas maskot utama + angka melayang ----
    const rr = (x: number, y: number, wdt: number, hgt: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + wdt, y, x + wdt, y + hgt, r);
      ctx.arcTo(x + wdt, y + hgt, x, y + hgt, r);
      ctx.arcTo(x, y + hgt, x, y, r);
      ctx.arcTo(x, y, x + wdt, y, r);
      ctx.closePath();
    };

    for (const side of ["p1", "p2"] as Side[]) {
      const main = placed[side][0];
      if (!main) continue;
      const pw = Math.max(118, cell * 0.54);
      const ph = Math.max(30, cell * 0.135);
      const px = main.x - pw / 2;
      const py = main.y - main.scale - ph - cell * 0.055;
      ctx.save();
      ctx.fillStyle = "rgba(26,34,46,.95)";
      rr(px, py, pw, ph, ph / 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(148,178,214,.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
      const icx = px + ph * 0.62;
      const icy = py + ph / 2;
      const ir = ph * 0.34;
      ctx.beginPath();
      ctx.arc(icx, icy, ir, 0, Math.PI * 2);
      ctx.fillStyle = "#101826";
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.stroke();
      const bolt: [number, number][] = [
        [0.16, -0.55],
        [-0.32, 0.15],
        [-0.03, 0.15],
        [-0.16, 0.55],
        [0.32, -0.15],
        [0.03, -0.15],
      ];
      ctx.beginPath();
      bolt.forEach(([bx, by], bi) => {
        const X = icx + bx * ir;
        const Y = icy + by * ir;
        if (bi === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      });
      ctx.closePath();
      ctx.fillStyle = "#facc15";
      ctx.fill();
      ctx.fillStyle = "#a8bcd2";
      ctx.font = `700 ${Math.round(ph * 0.32)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("KEKUATAN", px + ph * 1.15, icy + 1);
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${Math.round(ph * 0.6)}px system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(String(view.power.current[side]), px + pw - ph * 0.3, icy + 1);
      ctx.restore();
    }

    // angka melayang: +2 BONUS CEPAT / +1 / -1 TIDAK MENJAWAB
    const FLOAT_LIFE = 1150;
    const fl = view.floaters.current;
    for (let i = fl.length - 1; i >= 0; i--) {
      if (now - fl[i].bornAt > FLOAT_LIFE) fl.splice(i, 1);
    }
    const stackIdx: Record<Side, number> = { p1: 0, p2: 0 };
    for (const f of fl) {
      const main = placed[f.side][0];
      if (!main) continue;
      const age = now - f.bornAt;
      const t01 = clamp(age / FLOAT_LIFE, 0, 1);
      const rise = t01 * cell * 0.16;
      const alpha = t01 < 0.65 ? 1 : 1 - (t01 - 0.65) / 0.35;
      const dirC = f.side === "p1" ? 1 : -1;
      const cxF = main.x + dirC * cell * 0.4;
      const cyF = main.y - main.scale * 0.55 - rise - stackIdx[f.side] * cell * 0.15;
      stackIdx[f.side] += 1;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.font = `800 ${Math.round(cell * 0.155)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(4, cell * 0.02);
      ctx.strokeStyle = f.tone === "good" ? "#1a2e05" : "#450a0a";
      ctx.fillStyle = f.tone === "good" ? "#a3e635" : "#f87171";
      ctx.strokeText(f.text, cxF, cyF);
      ctx.fillText(f.text, cxF, cyF);
      if (f.tag) {
        ctx.font = `700 ${Math.round(cell * 0.05)}px system-ui, sans-serif`;
        const tw = ctx.measureText(f.tag).width + cell * 0.07;
        const th = cell * 0.085;
        const tx = cxF - tw / 2;
        const ty = cyF + cell * 0.115;
        ctx.fillStyle = f.tone === "good" ? "#16a34a" : "#dc2626";
        rr(tx, ty, tw, th, th / 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(f.tag, cxF, ty + th / 2 + 1);
      }
      ctx.restore();
    }

    dustTimer -= dt;
    if (Math.abs(vel) > 6 && dustTimer <= 0) {
      dustTimer = 90;
      emitDust(vel < 0 ? "p1" : "p2", 0.18);
    }

    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = `rgb(${p.color})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < 26; i++) {
      const gx = (i / 26) * w + ((i * 37) % 12);
      const sway = Math.sin(now * 0.0012 + i) * 5;
      ctx.strokeStyle = "rgba(30,58,28,.55)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(gx, h + 4);
      ctx.quadraticCurveTo(gx + sway * 0.4, h - h * 0.06, gx + sway, h - h * 0.1);
      ctx.stroke();
    }

    if (flash > 0.02) {
      ctx.fillStyle = `rgba(229,72,77,${flash * 0.18})`;
      ctx.fillRect(0, 0, w, h);
    }
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    vig.addColorStop(0, "rgba(20,32,20,0)");
    vig.addColorStop(1, "rgba(20,32,20,.22)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();

    if (view.shake.current > 0) view.shake.current = Math.max(0, view.shake.current - dt * 0.02);
    raf = requestAnimationFrame(loop);
  };

  raf = requestAnimationFrame(loop);

  return {
    stop: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      particles.length = 0;
    },
    emitDust,
    emitConfetti,
  };
}
