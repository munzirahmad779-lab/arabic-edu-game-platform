/**
 * Jejak Angka Ular Tangga: renderer papan kanvas (Log 77).
 *
 * Mengikuti spesifikasi terukur BASIRA-K1 (jejak-ular-work/
 * DESAIN-BASIRA.md): semua ukuran relatif terhadap sisi papan S.
 * Lapisan statis (rangka, sel, angka, ikon tercetak) dirender sekali
 * ke kanvas offscreen; tangga dan ular yang sudah terungkap digambar
 * di lapisan tengah; pion lencana di lapisan atas; spanduk kejutan
 * pil di tengah papan. Hasil acakan TIDAK digambar sebelum terungkap.
 */

import { PRINTED, type HiddenSpecial, type RacerState, type SpriteId } from "./logic";
import { FRAME, FRAME_INSET, frameCrop } from "./sprites";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const INK = "#17352B";
const INK_SOFT = "#3D6B57";

/* ------------------------------------------------------------ geometri */

/** Baris (0 = bawah) dan kolom (0 = kiri) sebuah kotak, penomoran berliku. */
export function squareRowCol(n: number): { row: number; col: number } {
  const b = Math.floor((n - 1) / 10);
  const p = (n - 1) % 10;
  return { row: b, col: b % 2 === 0 ? p : 9 - p };
}

export interface BoardGeom {
  pad: number;
  pitch: number;
  gap: number;
  cell: number;
}

export const boardGeom = (S: number): BoardGeom => {
  const pad = 0.012 * S;
  const pitch = (S - 2 * pad) / 10;
  const gap = 0.006 * S;
  return { pad, pitch, gap, cell: pitch - gap };
};

/** Pusat sebuah kotak dalam piksel kanvas. */
export function squareCenter(n: number, S: number): { x: number; y: number } {
  const g = boardGeom(S);
  const { row, col } = squareRowCol(n);
  return {
    x: g.pad + col * g.pitch + g.pitch / 2,
    y: S - g.pad - row * g.pitch - g.pitch / 2,
  };
}

function cellRect(n: number, S: number): { x: number; y: number; s: number } {
  const g = boardGeom(S);
  const { row, col } = squareRowCol(n);
  return {
    x: g.pad + col * g.pitch + g.gap / 2,
    y: S - g.pad - (row + 1) * g.pitch + g.gap / 2,
    s: g.cell,
  };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/* ------------------------------------------------------- lapisan statis */

const PRINTED_STYLE: Record<string, { fill: string; glyph: string; label: string; labelColor: string }> = {
  bintang: { fill: "#FFF3C4", glyph: "★", label: "BONUS", labelColor: "#B8860B" },
  kilat: { fill: "#D8F3FF", glyph: "⚡", label: "+4", labelColor: "#0277BD" },
  mundur: { fill: "#FFE3D3", glyph: "▼", label: "−4", labelColor: "#C1440E" },
  ujian: { fill: "#FFD9D9", glyph: "✎", label: "UJIAN", labelColor: "#B3261E" },
};

export function buildStaticBoard(S: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.max(2, Math.floor(S));
  cv.height = Math.max(2, Math.floor(S));
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  const g = boardGeom(S);

  rr(ctx, 1, 1, S - 2, S - 2, 0.018 * S);
  ctx.fillStyle = "#8FD0B2";
  ctx.fill();

  for (let n = 1; n <= 100; n++) {
    const { row, col } = squareRowCol(n);
    const rect = cellRect(n, S);
    const printed = PRINTED[n];
    let fill = (row + col) % 2 === 0 ? "#FFFDF4" : "#EFF8EE";
    if (n === 1) fill = "#BEE3C2";
    if (n === 100) fill = "#FFD94D";
    if (printed) fill = PRINTED_STYLE[printed].fill;
    rr(ctx, rect.x, rect.y, rect.s, rect.s, 0.12 * rect.s);
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.fillStyle = printed || n === 1 || n === 100 ? INK : INK_SOFT;
    ctx.font = `800 ${Math.max(11, 0.3 * g.cell)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(n), rect.x + 0.07 * g.cell, rect.y + 0.05 * g.cell);

    const label = (text: string, color: string) => {
      ctx.fillStyle = color;
      ctx.font = `900 ${Math.max(9, 0.16 * g.cell)}px system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(text, rect.x + rect.s - 0.06 * g.cell, rect.y + rect.s - 0.04 * g.cell);
    };
    if (n === 1) label("MULAI", "#1F7A3D");
    if (n === 100) label("FINISH", "#8A6100");
    if (printed) {
      const st = PRINTED_STYLE[printed];
      ctx.fillStyle = st.labelColor;
      ctx.font = `${Math.round(0.34 * g.cell)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(st.glyph, rect.x + rect.s / 2, rect.y + rect.s - 0.2 * g.cell);
      label(st.label, st.labelColor);
    }
  }
  return cv;
}

/* ------------------------------------------------- tangga dan ular */

function drawLadder(ctx: CanvasRenderingContext2D, spec: HiddenSpecial, S: number, progress: number): void {
  const g = boardGeom(S);
  const a = squareCenter(spec.from, S);
  const b = squareCenter(spec.to, S);
  const shrink = 0.18 * g.cell;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = a.x + ux * shrink;
  const y1 = a.y + uy * shrink;
  const x2 = b.x - ux * shrink;
  const y2 = b.y - uy * shrink;
  const px = -uy;
  const py = ux;
  const half = 0.17 * g.cell;
  const ox = (b.x - a.x) * (1 - progress) * 0.3;
  const oy = (b.y - a.y) * (1 - progress) * 0.3;
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.translate(-ox, -oy);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(23,53,43,0.15)";
  ctx.lineWidth = 0.15 * g.cell;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x1 + px * half * s + 0.03 * S, y1 + py * half * s + 0.03 * S);
    ctx.lineTo(x2 + px * half * s + 0.03 * S, y2 + py * half * s + 0.03 * S);
    ctx.stroke();
  }
  ctx.strokeStyle = "#B07D2B";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x1 + px * half * s, y1 + py * half * s);
    ctx.lineTo(x2 + px * half * s, y2 + py * half * s);
    ctx.stroke();
  }
  ctx.strokeStyle = "#D9A441";
  ctx.lineWidth = 0.12 * g.cell;
  const rungStep = 0.85 * g.cell;
  const rungs = Math.max(2, Math.floor((len - 2 * shrink) / rungStep));
  for (let i = 1; i < rungs; i++) {
    const t = i / rungs;
    const mx = x1 + (x2 - x1) * t;
    const my = y1 + (y2 - y1) * t;
    ctx.beginPath();
    ctx.moveTo(mx - px * half, my - py * half);
    ctx.lineTo(mx + px * half, my + py * half);
    ctx.stroke();
  }
  ctx.restore();
}

function snakeCurve(spec: HiddenSpecial, S: number): { a: { x: number; y: number }; c: { x: number; y: number }; b: { x: number; y: number } } {
  const g = boardGeom(S);
  const a = squareCenter(spec.from, S);
  const b = squareCenter(spec.to, S);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const side = spec.from % 2 === 0 ? 1 : -1;
  const off = 0.7 * g.cell * side;
  return {
    a,
    b,
    c: { x: (a.x + b.x) / 2 + (-dy / len) * off, y: (a.y + b.y) / 2 + (dx / len) * off },
  };
}

const quadAt = (p0: number, p1: number, p2: number, t: number): number =>
  (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;

function drawSnake(ctx: CanvasRenderingContext2D, spec: HiddenSpecial, S: number, progress: number): void {
  const g = boardGeom(S);
  const { a, c, b } = snakeCurve(spec, S);
  const steps = 26;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * progress;
    pts.push({ x: quadAt(a.x, c.x, b.x, t), y: quadAt(a.y, c.y, b.y, t) });
  }
  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 1.4);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < pts.length; i++) {
    const t = i / steps;
    const wdt = 0.3 * g.cell * (t > 0.8 ? (t > 0.92 ? 0.34 : 0.62) : 1);
    ctx.strokeStyle = "#3E9B4F";
    ctx.lineWidth = Math.max(1.5, wdt);
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  if (progress > 0.05) {
    ctx.strokeStyle = "#67C177";
    ctx.lineWidth = 0.13 * g.cell;
    ctx.setLineDash([0.06 * g.cell, 0.34 * g.cell]);
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (progress > 0.25) {
    const hr = 0.3 * g.cell;
    ctx.fillStyle = "#2F7D3E";
    ctx.beginPath();
    ctx.arc(a.x, a.y, hr, 0, Math.PI * 2);
    ctx.fill();
    const ang = Math.atan2(a.y - c.y, a.x - c.x);
    const ex = Math.cos(ang);
    const ey = Math.sin(ang);
    const pxn = -ey;
    const pyn = ex;
    for (const s of [-1, 1]) {
      const exx = a.x + ex * hr * 0.35 + pxn * hr * 0.38 * s;
      const eyy = a.y + ey * hr * 0.35 + pyn * hr * 0.38 * s;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(exx, eyy, 0.065 * g.cell, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(exx + ex * 0.03 * g.cell, eyy + ey * 0.03 * g.cell, 0.032 * g.cell, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#C1440E";
    ctx.lineWidth = Math.max(1.5, 0.045 * g.cell);
    const tx = a.x + ex * hr;
    const ty = a.y + ey * hr;
    const lx = tx + ex * 0.22 * g.cell;
    const ly = ty + ey * 0.22 * g.cell;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(lx, ly);
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + (ex * 0.5 + pxn * 0.5) * 0.1 * g.cell, ly + (ey * 0.5 + pyn * 0.5) * 0.1 * g.cell);
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + (ex * 0.5 - pxn * 0.5) * 0.1 * g.cell, ly + (ey * 0.5 - pyn * 0.5) * 0.1 * g.cell);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------- pion */

export interface TokenView {
  racer: RacerState;
  x: number;
  y: number;
  d: number;
  active: boolean;
}

/** Ukuran dan geser pion menurut jumlah pion berbagi satu kotak (BASIRA 1.5). */
export function tokenSlotGeom(count: number, index: number, cell: number): { d: number; dx: number; dy: number } {
  if (count <= 1) return { d: 0.92 * cell, dx: 0, dy: -0.06 * cell };
  if (count === 2) return { d: 0.54 * cell, dx: (index === 0 ? -0.2 : 0.2) * cell, dy: 0 };
  if (count === 3) {
    const pos = [
      { dx: -0.26, dy: -0.14 },
      { dx: 0.26, dy: -0.14 },
      { dx: 0, dy: 0.22 },
    ][index] ?? { dx: 0, dy: 0 };
    return { d: 0.5 * cell, dx: pos.dx * cell, dy: pos.dy * cell };
  }
  const pos = [
    { dx: -0.25, dy: -0.25 },
    { dx: 0.25, dy: -0.25 },
    { dx: -0.25, dy: 0.25 },
    { dx: 0.25, dy: 0.25 },
  ][index] ?? { dx: 0, dy: 0 };
  return { d: 0.46 * cell, dx: pos.dx * cell, dy: pos.dy * cell };
}

function drawToken(
  ctx: CanvasRenderingContext2D,
  view: TokenView,
  img: HTMLImageElement | null,
  cell: number,
  now: number,
): void {
  const { racer, x, y, d } = view;
  const r = d / 2;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(x, y + 4, r, 0, Math.PI * 2);
  ctx.fill();
  if (view.active) {
    const pulse = 0.45 + 0.25 * Math.sin((now / 1200) * Math.PI * 2);
    ctx.strokeStyle = racer.def.color;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = Math.max(2, 0.05 * cell);
    ctx.beginPath();
    ctx.arc(x, y, r + 0.07 * cell, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = racer.def.color;
  ctx.lineWidth = Math.max(2.5, 0.05 * cell);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    const crop = frameCrop(FRAME.happy);
    const size = d * 1.28;
    const inset = (FRAME_INSET[racer.def.sprite][FRAME.happy] / 256) * size;
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, x - size / 2, y - size / 2 + inset, size, size);
  } else {
    ctx.fillStyle = racer.def.soft;
    ctx.fillRect(x - r, y - r, d, d);
    ctx.fillStyle = racer.def.color;
    ctx.font = `900 ${Math.round(d * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(racer.def.name[0], x, y + 1);
  }
  ctx.restore();
  if (racer.ujian) {
    const mr = 0.16 * cell;
    const mx = x + r * 0.72;
    const my = y - r * 0.72;
    ctx.fillStyle = "#B3261E";
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `${Math.round(0.3 * cell)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✎", mx, my + 1);
  }
  ctx.restore();
}

/* --------------------------------------------------------- titik jalur */

/** Titik pion pada t (0..1) sepanjang jalur daftar kotak (jalan dadu / kilat / mundur). */
export function pathPoint(path: readonly number[], t: number, S: number): { x: number; y: number } {
  const g = boardGeom(S);
  if (path.length === 0) return { x: S / 2, y: S / 2 };
  if (path.length === 1) return squareCenter(path[0], S);
  const ft = Math.min(0.9999, Math.max(0, t)) * (path.length - 1);
  const i = Math.floor(ft);
  const frac = ft - i;
  const a = squareCenter(path[i], S);
  const b = squareCenter(path[Math.min(i + 1, path.length - 1)], S);
  return {
    x: a.x + (b.x - a.x) * frac,
    y: a.y + (b.y - a.y) * frac - Math.sin(frac * Math.PI) * 0.18 * g.cell,
  };
}

/** Titik pion pada t (0..1) saat naik tangga (lurus) atau meluncur ular (kurva). */
export function specialPoint(spec: HiddenSpecial, t: number, S: number): { x: number; y: number } {
  if (spec.kind === "tangga") {
    const a = squareCenter(spec.from, S);
    const b = squareCenter(spec.to, S);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  const { a, c, b } = snakeCurve(spec, S);
  return { x: quadAt(a.x, c.x, b.x, t), y: quadAt(a.y, c.y, b.y, t) };
}

/* ------------------------------------------------------------ adegan */

export interface BoardBanner {
  text: string;
  color: string;
  /** Kemajuan tampil 0..1 (masuk, menetap, memudar dihitung di sini). */
  progress: number;
}

export interface SceneOpts {
  S: number;
  bg: HTMLCanvasElement;
  revealed: { spec: HiddenSpecial; progress: number }[];
  tokens: TokenView[];
  images: Map<SpriteId, HTMLImageElement | null>;
  banner: BoardBanner | null;
  now: number;
}

export function drawScene(ctx: CanvasRenderingContext2D, o: SceneOpts): void {
  const { S } = o;
  const g = boardGeom(S);
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(o.bg, 0, 0, S, S);
  for (const r of o.revealed) {
    const rect = cellRect(r.spec.from, S);
    ctx.strokeStyle = "#8E44AD";
    ctx.lineWidth = Math.max(3, 0.045 * g.cell);
    rr(ctx, rect.x + 2, rect.y + 2, rect.s - 4, rect.s - 4, 0.12 * rect.s);
    ctx.stroke();
    if (g.cell >= 44) {
      ctx.fillStyle = "#8E44AD";
      ctx.font = `900 ${Math.max(9, 0.15 * g.cell)}px system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("TERUNGKAP", rect.x + rect.s - 0.06 * g.cell, rect.y + rect.s - 0.04 * g.cell);
    }
    if (r.spec.kind === "tangga") drawLadder(ctx, r.spec, S, r.progress);
    else drawSnake(ctx, r.spec, S, r.progress);
  }
  for (const t of o.tokens) {
    drawToken(ctx, t, o.images.get(t.racer.def.sprite) ?? null, g.cell, o.now);
  }
  if (o.banner) {
    const p = o.banner.progress;
    const alpha = p < 0.125 ? p / 0.125 : p > 0.875 ? (1 - p) / 0.125 : 1;
    const scale = 0.8 + 0.2 * Math.min(1, p / 0.125);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(S / 2, 0.44 * S);
    ctx.scale(scale, scale);
    ctx.font = `800 ${Math.max(15, Math.min(22, 0.26 * g.cell))}px system-ui, sans-serif`;
    const wText = ctx.measureText(o.banner.text).width;
    const w = wText + 36;
    const h = Math.max(34, 0.52 * g.cell);
    rr(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = o.banner.color;
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(o.banner.text, 0, 1);
    ctx.restore();
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: readonly Particle[]): void {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
