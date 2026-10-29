/**
 * Perang Antariksa — renderer kanvas (Log 60).
 *
 * Angkasa siang cerah khas Magguru (bukan luar angkasa gelap generik):
 * gradien biru muda ke ungu pastel, bintang lembut, planet permen.
 * Tiap lajur: kartu HUD di atas (maskot + nama + skor + soal aktif
 * dibungkus maks 3 baris, pola Log 59), asteroid pembawa soal meluncur
 * turun, roket bermaskot di garis pertahanan bawah. Keypad adalah DOM
 * (di Game.tsx), bukan bagian kanvas ini.
 */

import type { LaneDef, NQ } from "./logic";
import { FRAME, SPRITES, frameCrop, type FrameIndex } from "./sprites";

/* ------------------------------------------------------------- entitas */

export interface Rock {
  id: number;
  lane: number;
  q: NQ;
  /** urutan pilihan yang sudah diacak, hanya untuk soal kind "teks" */
  opts?: string[];
  x: number;
  y: number;
  r: number;
  vy: number;
  wobble: number;
  shakeUntil: number;
}

export interface LaneView {
  def: LaneDef;
  score: number;
  streak: number;
  mood: FrameIndex;
  moodUntil: number;
  question: NQ | null;
}

export interface Laser { lane: number; x: number; yTop: number; bornAt: number; color: string }
export interface Particle { x: number; y: number; vx: number; vy: number; bornAt: number; life: number; color: string; size: number }
export interface Popup { x: number; y: number; text: string; color: string; bornAt: number }

export interface ArenaInput {
  lanes: LaneView[];
  rocks: Rock[];
  lasers: Laser[];
  particles: Particle[];
  popups: Popup[];
  now: number;
  width: number;
  height: number;
}

export const LASER_LIFE = 150;
export const POPUP_LIFE = 950;

/* ------------------------------------------------------------ gambar */

const imgCache = new Map<string, HTMLImageElement>();
let imagesRequested = false;

export function ensureImages(): void {
  if (imagesRequested || typeof window === "undefined") return;
  imagesRequested = true;
  (Object.keys(SPRITES) as (keyof typeof SPRITES)[]).forEach((id) => {
    const img = new Image();
    img.src = SPRITES[id].src;
    imgCache.set(id, img);
  });
}

function ready(id: string): HTMLImageElement | null {
  const img = imgCache.get(id);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

/* ------------------------------------------------- teks multi-baris */

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

const FONT_STACK = "ui-sans-serif, system-ui, sans-serif";

export function questionFontPx(laneW: number): number {
  return Math.max(11, Math.min(14, laneW * 0.042));
}
export function questionFont(laneW: number): string {
  return `600 ${questionFontPx(laneW)}px ${FONT_STACK}`;
}

export function wrapTextLines(text: string, font: string, maxW: number, maxLines: number): string[] {
  const ctx = measurer();
  if (!ctx || maxW <= 10) return [text];
  ctx.font = font;
  const words = text.split(/\s+/).filter((s) => s.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(trial).width <= maxW || cur === "") cur = trial;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  if (lines.length === 0) return [text];
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

/** Zona maskot + nama + skor di atas kartu. */
const HUD_TOP = 56;

export function hudHeight(laneW: number, prompt: string | null): number {
  if (!prompt) return HUD_TOP + 10;
  // Tinggi kartu DICADANGKAN tetap untuk 3 baris soal: headerBottom arena
  // konstan selama ronde, jadi asteroid tidak pernah muncul di bawah
  // asteroid sebelumnya hanya karena kartu soal berubah tinggi.
  return HUD_TOP + 3 * questionFontPx(laneW) * 1.32 + 10;
}

/** Garis pertahanan: roket berdiri di garis ini, asteroid tidak boleh lewat. */
export function defenceY(height: number): number {
  return height - 104;
}

/* ------------------------------------------------------------- helper */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/* ---------------------------------------------------------------- HUD */

function drawHud(ctx: CanvasRenderingContext2D, lane: LaneView, x: number, y: number, w: number, now: number): void {
  const laneW = w + 20;
  const qPx = questionFontPx(laneW);
  const q = lane.question;
  const lines = q ? wrapTextLines(q.prompt, questionFont(laneW), Math.max(40, w - 24), 3) : [];
  const h = hudHeight(laneW, q ? q.prompt : null);

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, lane.def.gradFrom);
  grad.addColorStop(1, lane.def.gradTo);
  ctx.save();
  ctx.fillStyle = "rgba(30,27,75,0.28)";
  roundRect(ctx, x, y + 5, w, h, 22);
  ctx.fill();
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.restore();

  if (lane.mood === FRAME.happy && now < lane.moodUntil) {
    const t = 1 - (lane.moodUntil - now) / 420;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.5 * (1 - t));
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 22);
    ctx.stroke();
    ctx.restore();
  }

  // maskot pilot kecil di kartu
  const avatar = 40;
  const img = ready(lane.def.sprite);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + 10 + avatar / 2, y + 8 + avatar / 2, avatar / 2, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const crop = frameCrop(lane.mood);
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, x + 10, y + 8, avatar, avatar);
  } else {
    ctx.fillStyle = SPRITES[lane.def.sprite].fallback;
    ctx.fillRect(x + 10, y + 8, avatar, avatar);
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + 10 + avatar / 2, y + 8 + avatar / 2, avatar / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 13px ${FONT_STACK}`;
  ctx.fillText(lane.def.name.toUpperCase(), x + 58, y + 19, w - 66);
  ctx.font = `800 17px ${FONT_STACK}`;
  ctx.fillStyle = lane.def.accent;
  const skorTeks = lane.streak >= 3 ? `${lane.score}  🔥${lane.streak}` : `${lane.score}`;
  ctx.fillText(skorTeks, x + 58, y + 39, w - 66);

  if (q && lines.length > 0) {
    ctx.font = questionFont(laneW);
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    const lineH = qPx * 1.32;
    for (let i = 0; i < lines.length; i++) {
      const ly = y + HUD_TOP + (i + 0.5) * lineH;
      if (q.isArabic) {
        ctx.textAlign = "right";
        ctx.direction = "rtl";
        ctx.fillText(lines[i], x + w - 12, ly);
        ctx.direction = "ltr";
        ctx.textAlign = "left";
      } else {
        ctx.fillText(lines[i], x + 12, ly);
      }
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------ roket */

function drawShip(ctx: CanvasRenderingContext2D, lane: LaneView, cx: number, groundY: number, now: number): void {
  const bob = Math.sin(now / 480 + lane.def.slot * 1.7) * 3;
  const cy = groundY - 34 + bob;
  const color = lane.def.ship;
  ctx.save();
  ctx.translate(cx, cy);
  // api roket
  const flame = 12 + Math.sin(now / 60 + lane.def.slot) * 4;
  ctx.fillStyle = "#FBBF24";
  ctx.beginPath();
  ctx.moveTo(-8, 26);
  ctx.lineTo(0, 26 + flame);
  ctx.lineTo(8, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#F97316";
  ctx.beginPath();
  ctx.moveTo(-5, 26);
  ctx.lineTo(0, 26 + flame * 0.62);
  ctx.lineTo(5, 26);
  ctx.closePath();
  ctx.fill();
  // sayap
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-13, 6);
  ctx.lineTo(-27, 26);
  ctx.lineTo(-13, 26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(13, 6);
  ctx.lineTo(27, 26);
  ctx.lineTo(13, 26);
  ctx.closePath();
  ctx.fill();
  // badan
  const bodyGrad = ctx.createLinearGradient(0, -30, 0, 28);
  bodyGrad.addColorStop(0, "#FFFFFF");
  bodyGrad.addColorStop(1, "#E2E8F0");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.quadraticCurveTo(15, -12, 14, 10);
  ctx.lineTo(12, 26);
  ctx.lineTo(-12, 26);
  ctx.lineTo(-14, 10);
  ctx.quadraticCurveTo(-15, -12, 0, -32);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // kokpit: wajah maskot
  const img = ready(lane.def.sprite);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, -6, 11.5, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const crop = frameCrop(FRAME.happy);
    ctx.drawImage(img, crop.sx + 42, crop.sy + 6, 172, 172, -11.5, -17.5, 23, 23);
  } else {
    ctx.fillStyle = SPRITES[lane.def.sprite].fallback;
    ctx.fillRect(-11.5, -17.5, 23, 23);
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -6, 11.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ---------------------------------------------------------- asteroid */

function drawRock(ctx: CanvasRenderingContext2D, rock: Rock, active: boolean, now: number): void {
  const shake = now < rock.shakeUntil ? Math.sin(now / 24) * 4 : 0;
  const cx = rock.x + Math.sin((now + rock.id * 977) / 700 + rock.wobble) * 4 + shake;
  const cy = rock.y;
  const r = rock.r;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin((now + rock.id * 613) / 900 + rock.wobble) * 0.08);
  if (active) {
    ctx.save();
    ctx.strokeStyle = "rgba(250,204,21,0.95)";
    ctx.lineWidth = 3.5;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -now / 28;
    ctx.beginPath();
    ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.15);
  grad.addColorStop(0, "#FDE68A");
  grad.addColorStop(0.55, "#F59E0B");
  grad.addColorStop(1, "#B45309");
  ctx.fillStyle = grad;
  ctx.beginPath();
  const bumps = 9;
  for (let i = 0; i <= bumps; i++) {
    const a = (i / bumps) * Math.PI * 2;
    const rr = r * (0.88 + 0.13 * Math.abs(Math.sin(rock.id * 3.7 + i * 1.93)));
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(120,53,15,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // kawah kecil
  ctx.fillStyle = "rgba(146,64,14,0.35)";
  ctx.beginPath();
  ctx.arc(-r * 0.34, r * 0.18, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.3, r * 0.42, r * 0.11, 0, Math.PI * 2);
  ctx.fill();

  // teks di wajah batu: soal angka pendek tampil utuh; soal teks dan soal
  // panjang cukup "?" (pertanyaan lengkapnya ada di kartu lajur)
  ctx.fillStyle = "#451A03";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (rock.q.kind === "angka" && rock.q.prompt.length <= 15) {
    ctx.font = `800 ${Math.max(13, r * 0.34)}px ${FONT_STACK}`;
    if (rock.q.isArabic) ctx.direction = "rtl";
    ctx.fillText(rock.q.prompt, 0, 1, r * 1.7);
    ctx.direction = "ltr";
  } else {
    ctx.font = `800 ${r * 0.72}px ${FONT_STACK}`;
    ctx.fillText(active ? "?" : "…", 0, 2);
  }
  ctx.restore();
}

/* -------------------------------------------------------------- frame */

/** Latar statis (gradien, bintang, planet, lajur, garis pertahanan)
 * digambar sekali per ukuran lalu disimpan; bingkai berikutnya cukup
 * menyalin gambarnya. Penting untuk perangkat kelas yang lambat. */
let bgCache: { key: string; cv: HTMLCanvasElement } | null = null;

function buildBackground(width: number, height: number, n: number, defY: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(width));
  cv.height = Math.max(1, Math.round(height));
  const c = cv.getContext("2d");
  if (!c) return cv;
  const laneW = width / n;
  const bg = c.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#93C5FD");
  bg.addColorStop(0.55, "#C7D2FE");
  bg.addColorStop(1, "#FBCFE8");
  c.fillStyle = bg;
  c.fillRect(0, 0, width, height);
  c.fillStyle = "rgba(255,255,255,0.75)";
  for (let i = 0; i < 46; i++) {
    const sx = ((i * 269) % 997) / 997 * width;
    const sy = ((i * 173) % 991) / 991 * height * 0.82;
    const tw = 1.4 + ((i * 37) % 10) / 6;
    c.beginPath();
    c.arc(sx, sy, Math.max(0.7, tw), 0, Math.PI * 2);
    c.fill();
  }
  c.save();
  c.globalAlpha = 0.5;
  c.fillStyle = "#F9A8D4";
  c.beginPath(); c.arc(width * 0.86, height * 0.16, 30, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#A5B4FC";
  c.beginPath(); c.arc(width * 0.08, height * 0.3, 20, 0, Math.PI * 2); c.fill();
  c.restore();
  for (let i = 0; i < n; i++) {
    const x = i * laneW;
    if (i % 2 === 0) { c.fillStyle = "rgba(255,255,255,0.16)"; c.fillRect(x, 0, laneW, height); }
    c.strokeStyle = "rgba(30,27,75,0.14)";
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, height); c.stroke();
    c.save();
    c.strokeStyle = "rgba(220,38,38,0.55)";
    c.lineWidth = 2.5;
    c.setLineDash([10, 7]);
    c.beginPath(); c.moveTo(x + 6, defY); c.lineTo(x + laneW - 6, defY); c.stroke();
    c.restore();
  }
  return cv;
}

export function drawFrame(ctx: CanvasRenderingContext2D, input: ArenaInput): void {
  const { lanes, rocks, lasers, particles, popups, now, width, height } = input;
  const n = Math.max(1, lanes.length);
  const laneW = width / n;
  const defY = defenceY(height);

  ctx.clearRect(0, 0, width, height);
  const key = `${Math.round(width)}x${Math.round(height)}x${n}`;
  if (!bgCache || bgCache.key !== key) {
    bgCache = { key, cv: buildBackground(width, height, n, defY) };
  }
  ctx.drawImage(bgCache.cv, 0, 0, width, height);

  // asteroid aktif = yang paling bawah (y terbesar) di lajurnya
  const lowest = new Map<number, Rock>();
  for (const rock of rocks) {
    const cur = lowest.get(rock.lane);
    if (!cur || rock.y > cur.y) lowest.set(rock.lane, rock);
  }
  for (const rock of rocks) drawRock(ctx, rock, lowest.get(rock.lane)?.id === rock.id, now);

  // laser
  for (const l of lasers) {
    const age = now - l.bornAt;
    if (age < 0 || age > LASER_LIFE) continue;
    const lane = lanes[l.lane];
    if (!lane) continue;
    const x = l.lane * laneW + laneW / 2;
    ctx.save();
    ctx.globalAlpha = 1 - age / LASER_LIFE;
    ctx.strokeStyle = l.color;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, defY - 58); ctx.lineTo(x, l.yTop); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, defY - 58); ctx.lineTo(x, l.yTop); ctx.stroke();
    ctx.restore();
  }

  // partikel ledakan
  for (const p of particles) {
    const t = (now - p.bornAt) / p.life;
    if (t < 0 || t > 1) continue;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x + p.vx * t, p.y + p.vy * t + 130 * t * t, p.size * (1 - t * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // roket tiap lajur
  for (let i = 0; i < n; i++) {
    const lane = lanes[i];
    if (lane) drawShip(ctx, lane, i * laneW + laneW / 2, defY + 62, now);
  }

  // popup skor
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of popups) {
    const t = (now - p.bornAt) / POPUP_LIFE;
    if (t < 0 || t > 1) continue;
    ctx.globalAlpha = 1 - t * t;
    ctx.font = `800 24px ${FONT_STACK}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    const py = p.y - 44 * t;
    ctx.strokeText(p.text, p.x, py);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, py);
  }
  ctx.restore();

  // kartu HUD paling atas
  for (let i = 0; i < n; i++) {
    const lane = lanes[i];
    if (lane) drawHud(ctx, lane, i * laneW + 10, 10, Math.max(60, laneW - 20), now);
  }
}

export function burst(x: number, y: number, color: string, now: number, count = 16): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const sp = 60 + Math.random() * 170;
    out.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      bornAt: now,
      life: 480 + Math.random() * 320,
      color: i % 3 === 0 ? "#FFFFFF" : color,
      size: 3 + Math.random() * 4.5,
    });
  }
  return out;
}
