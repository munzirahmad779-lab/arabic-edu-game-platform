/**
 * Banua Fruit Blast — renderer kanvas 2D + fisika buah jatuh.
 *
 * Kanvas dibagi menjadi lajur (lane) sebanyak peserta. Tiap lajur punya
 * kartu HUD maskot + soal sendiri yang digambar PALING ATAS, dan buah
 * foto hanya muncul di bawah kartu itu.
 *
 * Buah dipotong dengan geseran: renderer menggambar belahan buah yang
 * terpisah, isi sembunyi yang terbuka (bom / buah emas), cipratan jus,
 * tulisan poin melayang, dan jejak mata pisau.
 *
 * Aturan teknis yang dipatuhi:
 *  - devicePixelRatio dihitung ulang lewat ResizeObserver (di Game.tsx)
 *  - requestAnimationFrame dibatalkan pada cleanup (di Game.tsx)
 *  - tidak ada alokasi array besar per frame (partikel dibatasi RULES)
 */

import {
  RULES,
  type Fruit,
  type FruitSpriteId,
  type Particle,
  type PlayerDef,
  type Q,
  type SpriteId,
} from "./logic";
import { BOM_SRC, EMAS_SRC, FRAME, frameCrop, FRUIT_SPRITES, SPRITES, type FrameIndex } from "./sprites";

export interface LaneState {
  def: PlayerDef;
  score: number;
  question: Q | null;
  /** indeks frame ekspresi maskot (0..3) */
  mood: FrameIndex;
  /** waktu (ms) sampai ekspresi kembali normal */
  moodUntil: number;
}

/** Efek belahan buah sesudah dipotong (berumur pendek, digambar dari bornAt). */
export interface SliceFx {
  id: number;
  lane: number;
  sprite: FruitSpriteId;
  x: number;
  y: number;
  w: number;
  h: number;
  /** isi sembunyi yang terbuka saat buah terpotong */
  reveal: "none" | "gold" | "bomb";
  /** belahan menghitam (kena bom) */
  dark: boolean;
  bornAt: number;
}

export const FX_LIFE_MS = 850;

/** Tulisan poin melayang (+2 / -1 / ...) sesudah potongan dinilai. */
export interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  bornAt: number;
}

export const POPUP_LIFE_MS = 950;

/** Satu titik jejak mata pisau dari satu penunjuk (pointer). */
export interface TrailPt {
  x: number;
  y: number;
  t: number;
}

export interface ArenaInput {
  lanes: LaneState[];
  fruits: Fruit[];
  particles: Particle[];
  fx: SliceFx[];
  popups: Popup[];
  trails: TrailPt[][];
  /** guncangan layar (bom) berakhir pada waktu ini (ms) */
  shakeUntil: number;
  /** waktu sekarang dari rAF (ms) */
  now: number;
  /** lebar/tinggi CSS kanvas */
  width: number;
  height: number;
}

/* ------------------------------------------------------------ pemuat gambar */

const IMAGES: Partial<Record<SpriteId, HTMLImageElement>> = {};
let imagesRequested = false;

/** Panggil sekali di client; gambar dimuat lazy dan boleh gagal. */
export function ensureImages(): void {
  if (imagesRequested || typeof window === "undefined") return;
  imagesRequested = true;
  (Object.keys(SPRITES) as SpriteId[]).forEach((id) => {
    const img = new Image();
    img.decoding = "async";
    img.src = SPRITES[id].src;
    IMAGES[id] = img;
  });
}

const FRUIT_IMAGES: Partial<Record<FruitSpriteId, HTMLImageElement>> = {};
let bomImage: HTMLImageElement | null = null;
let emasImage: HTMLImageElement | null = null;
let fruitImagesRequested = false;

/** Panggil sekali di client; memuat sprite buah foto + bom + buah emas. */
export function ensureFruitImages(): void {
  if (fruitImagesRequested || typeof window === "undefined") return;
  fruitImagesRequested = true;
  (Object.keys(FRUIT_SPRITES) as FruitSpriteId[]).forEach((id) => {
    const img = new Image();
    img.decoding = "async";
    img.src = FRUIT_SPRITES[id].src;
    FRUIT_IMAGES[id] = img;
  });
  const b = new Image();
  b.decoding = "async";
  b.src = BOM_SRC;
  bomImage = b;
  const e = new Image();
  e.decoding = "async";
  e.src = EMAS_SRC;
  emasImage = e;
}

const ready = (id: SpriteId): HTMLImageElement | null => {
  const img = IMAGES[id];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
};

const fruitReady = (id: FruitSpriteId): HTMLImageElement | null => {
  const img = FRUIT_IMAGES[id];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
};

const imgOk = (img: HTMLImageElement | null): HTMLImageElement | null =>
  img && img.complete && img.naturalWidth > 0 ? img : null;

/* ------------------------------------------------------------------- util */

/** Kotak membulat, dengan fallback bila roundRect tidak tersedia. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/* ----------------------------------------------------------------- maskot */

/** Maskot prosedural bila PNG belum/gagal dimuat. */
function drawFallbackMascot(
  ctx: CanvasRenderingContext2D,
  color: string,
  cx: number,
  cy: number,
  size: number,
  mood: FrameIndex,
): void {
  const r = size / 2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx - r * 0.55, cy - r * 0.55, r * 0.28, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.55, cy - r * 0.55, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1F2937";
  const eyeY = cy - r * 0.12;
  const eyeDx = r * 0.3;
  const eyeR = mood === FRAME.shock ? r * 0.16 : r * 0.1;
  ctx.beginPath();
  ctx.arc(cx - eyeDx, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(cx + eyeDx, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1F2937";
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  if (mood === FRAME.miss) {
    ctx.arc(cx, cy + r * 0.5, r * 0.26, Math.PI * 1.15, Math.PI * 1.85);
  } else {
    ctx.arc(cx, cy + r * 0.16, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  ctx.stroke();
  ctx.restore();
}

function drawMascot(
  ctx: CanvasRenderingContext2D,
  id: SpriteId,
  color: string,
  cx: number,
  cy: number,
  size: number,
  mood: FrameIndex,
): void {
  const img = ready(id);
  if (!img) {
    drawFallbackMascot(ctx, color, cx, cy, size, mood);
    return;
  }
  const crop = frameCrop(mood);
  ctx.drawImage(
    img,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    cx - size / 2,
    cy - size / 2,
    size,
    size,
  );
}

/* ------------------------------------------- teks multi-baris (Log 59) */

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

/** Bungkus teks menjadi baris-baris selebar maxW; kelebihan baris terakhir dipotong dengan "…". */
export function wrapTextLines(text: string, font: string, maxW: number, maxLines: number): string[] {
  const ctx = measurer();
  if (!ctx || maxW <= 10) return [text];
  ctx.font = font;
  const words = text.split(/\s+/).filter((s) => s.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(trial).width <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
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

function widestLine(lines: string[], font: string): number {
  const ctx = measurer();
  if (!ctx) return 0;
  ctx.font = font;
  let w = 0;
  for (const line of lines) w = Math.max(w, ctx.measureText(line).width);
  return w;
}

/** Zona maskot + nama + skor di bagian atas kartu lajur. */
const HUD_TOP = 56;

/** Tinggi kartu lajur mengikuti jumlah baris soal (maks 3 baris). */
export function hudHeight(laneW: number, prompt: string | null): number {
  if (!prompt) return HUD_TOP + 10;
  const lines = wrapTextLines(prompt, questionFont(laneW), Math.max(40, laneW - 44), 3);
  return HUD_TOP + lines.length * questionFontPx(laneW) * 1.32 + 10;
}

/** Setengah lebar pita jawaban (maks 2 baris) untuk buah berteks ini. */
export function pillHalfWidth(text: string, laneW: number): number {
  const isAr = /[\u0600-\u06FF]/.test(text);
  const font = `800 ${isAr ? 19 : 17}px ${FONT_STACK}`;
  const maxPillW = Math.min(250, Math.max(70, laneW - 12));
  const lines = wrapTextLines(text, font, maxPillW - 26, 2);
  const pillW = Math.min(Math.max(widestLine(lines, font) + 26, 64), maxPillW);
  return pillW / 2;
}

/* -------------------------------------------------------------------- HUD */

function drawHud(ctx: CanvasRenderingContext2D, lane: LaneState, x: number, y: number, w: number, now: number): void {
  const laneW = w + 20;
  const qPx = questionFontPx(laneW);
  const q = lane.question;
  const lines = q ? wrapTextLines(q.prompt, questionFont(laneW), Math.max(40, w - 24), 3) : [];
  const h = HUD_TOP + (lines.length > 0 ? lines.length * qPx * 1.32 : 0) + 10;
  const r = 22;

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, lane.def.gradFrom);
  grad.addColorStop(1, lane.def.gradTo);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  // kilau saat baru menjawab benar
  if (lane.mood === FRAME.happy && now < lane.moodUntil) {
    const t = 1 - (lane.moodUntil - now) / 420;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.5 * (1 - t));
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.restore();
  }

  const avatar = 40;
  drawMascot(ctx, lane.def.sprite, lane.def.gradTo, x + 10 + avatar / 2, y + 8 + avatar / 2, avatar, lane.mood);

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 13px ${FONT_STACK}`;
  ctx.fillText(lane.def.name.toUpperCase(), x + 58, y + 20, w - 66);

  ctx.font = `800 17px ${FONT_STACK}`;
  ctx.fillStyle = lane.def.accent;
  ctx.fillText(`${lane.score}`, x + 58, y + 39, w - 66);

  if (q && lines.length > 0) {
    ctx.font = questionFont(laneW);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
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

/* -------------------------------------------------------------------- buah */

function drawFruit(ctx: CanvasRenderingContext2D, f: Fruit, accent: string, now: number, laneW: number): void {
  const sway = Math.sin((now + f.id * 613) / 520 + f.wobble);
  const cx = f.x + sway * 3;
  const cy = f.y;
  const popScale = 1 - Math.max(0, f.pop) * 0.3;
  const flipping = now < f.flipUntil;
  const flipT = flipping ? Math.max(0, (f.flipUntil - now) / 450) : 0;
  // saat reshuffle label jungkir: buah menyusut horizontal lalu kembali
  const flipScale = flipping ? Math.abs(Math.cos(flipT * Math.PI)) * 0.55 + 0.45 : 1;
  const w = f.w * popScale * flipScale;
  const h = f.h * popScale;
  const rot = sway * 0.07;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // bayangan lembut
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;

  const img = fruitReady(f.sprite);
  if (img) {
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    // cadangan prosedural selama foto belum termuat
    const grad = ctx.createRadialGradient(-w * 0.15, -h * 0.2, 4, 0, 0, Math.max(w, h) * 0.62);
    grad.addColorStop(0, "#FDE68A");
    grad.addColorStop(1, FRUIT_SPRITES[f.sprite].juice);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // pita putih berisi teks jawaban, menggantung di bawah buah;
  // jawaban panjang dibungkus 2 baris (Log 59), tidak dimampatkan lagi
  const isAr = /[\u0600-\u06FF]/.test(f.text);
  const fontPx = isAr ? 19 : 17;
  const pillFont = `800 ${fontPx}px ${FONT_STACK}`;
  const maxPillW = Math.min(250, Math.max(70, laneW - 12));
  const pillLines = wrapTextLines(f.text, pillFont, maxPillW - 26, 2);
  ctx.font = pillFont;
  let tw = 0;
  for (const line of pillLines) tw = Math.max(tw, ctx.measureText(line).width);
  const pillW = Math.min(Math.max(tw + 26, 64), maxPillW) * flipScale;
  const pillH = pillLines.length > 1 ? 48 : 30;
  const pillY = h / 2 + 4;
  if (pillW > 8) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.30)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    roundRect(ctx, -pillW / 2, pillY, pillW, pillH, 15);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    roundRect(ctx, -pillW / 2, pillY, pillW, pillH, 15);
    ctx.stroke();
    ctx.fillStyle = "#065F46";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (isAr) ctx.direction = "rtl";
    for (let i = 0; i < pillLines.length; i++) {
      const ly = pillY + pillH / 2 + (i - (pillLines.length - 1) / 2) * (fontPx + 4);
      ctx.fillText(pillLines[i], 0, ly + 1);
    }
    ctx.direction = "ltr";
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------------------------------------- efek potong & teks */

function drawFx(ctx: CanvasRenderingContext2D, fx: SliceFx, now: number): void {
  const age = now - fx.bornAt;
  if (age < 0 || age > FX_LIFE_MS) return;
  const t = age / FX_LIFE_MS;
  const img = fruitReady(fx.sprite);
  const offX = 52 * t;
  const offY = -36 * t + 170 * t * t;
  const rot = 0.85 * t;
  const alpha = Math.max(0, 1 - Math.pow(t, 1.6));

  ctx.save();
  ctx.globalAlpha = alpha;
  if (fx.dark) ctx.filter = "brightness(0.5) saturate(0.6)";
  if (img) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    // belahan kiri
    ctx.save();
    ctx.translate(fx.x - offX, fx.y + offY);
    ctx.rotate(-rot);
    ctx.drawImage(img, 0, 0, iw / 2, ih, -fx.w / 2, -fx.h / 2, fx.w / 2, fx.h);
    ctx.restore();
    // belahan kanan
    ctx.save();
    ctx.translate(fx.x + offX, fx.y + offY);
    ctx.rotate(rot);
    ctx.drawImage(img, iw / 2, 0, iw / 2, ih, 0, -fx.h / 2, fx.w / 2, fx.h);
    ctx.restore();
  } else {
    ctx.fillStyle = FRUIT_SPRITES[fx.sprite].juice;
    ctx.beginPath();
    ctx.arc(fx.x - offX, fx.y + offY, fx.w * 0.3, 0, Math.PI * 2);
    ctx.arc(fx.x + offX, fx.y + offY, fx.w * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ledakan bom: kilatan awal
  if (fx.reveal === "bomb" && age < 320) {
    const bt = age / 320;
    ctx.save();
    ctx.globalAlpha = 0.75 * (1 - bt);
    const rg = ctx.createRadialGradient(fx.x, fx.y, 4, fx.x, fx.y, 40 + 90 * bt);
    rg.addColorStop(0, "#FFF7ED");
    rg.addColorStop(0.45, "#FB923C");
    rg.addColorStop(1, "rgba(249,115,22,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 40 + 90 * bt, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // isi sembunyi yang terbuka: bom / buah emas muncul di tengah belahan
  if (fx.reveal !== "none" && age < 720) {
    const revealImg = imgOk(fx.reveal === "bomb" ? bomImage : emasImage);
    if (revealImg) {
      const rt = Math.min(1, age / 150);
      const scale = 0.4 + 0.6 * (1 - Math.pow(1 - rt, 3));
      const size = 76 * scale;
      const rise = -26 * Math.min(1, age / 720);
      ctx.save();
      ctx.globalAlpha = age > 560 ? Math.max(0, 1 - (age - 560) / 160) : 1;
      ctx.shadowColor = fx.reveal === "gold" ? "rgba(250,204,21,0.8)" : "rgba(0,0,0,0.5)";
      ctx.shadowBlur = fx.reveal === "gold" ? 18 : 8;
      ctx.drawImage(revealImg, fx.x - size / 2, fx.y - size / 2 + rise, size, size);
      ctx.restore();
    }
  }
}

function drawPopups(ctx: CanvasRenderingContext2D, list: Popup[], now: number): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const age = now - p.bornAt;
    if (age < 0 || age > POPUP_LIFE_MS) continue;
    const t = age / POPUP_LIFE_MS;
    ctx.globalAlpha = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
    ctx.font = "900 27px ui-sans-serif, system-ui, sans-serif";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(6,40,28,0.85)";
    const y = p.y - 46 * t;
    ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawTrails(ctx: CanvasRenderingContext2D, trails: TrailPt[][], now: number): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < trails.length; i++) {
    const pts = trails[i].filter((pt) => now - pt.t < 130);
    if (pts.length < 2) continue;
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1];
      const b = pts[j];
      const fresh = 1 - (now - b.t) / 130;
      ctx.strokeStyle = `rgba(255,255,255,${0.28 * fresh})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * fresh})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]): void {
  ctx.save();
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ------------------------------------------------------------------- frame */

/** Menggambar satu frame penuh. Tidak mengubah state domain. */
export function drawFrame(ctx: CanvasRenderingContext2D, input: ArenaInput): void {
  const { lanes, fruits, particles, fx, popups, trails, shakeUntil, now, width, height } = input;
  const n = Math.max(1, lanes.length);
  const laneW = width / n;

  ctx.clearRect(0, 0, width, height);

  // latar kebun siang cerah (tema Magguru)
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#7DD3FC");
  bg.addColorStop(1, "#BBF7D0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  if (now < shakeUntil) {
    const k = Math.max(0, (shakeUntil - now) / 380);
    ctx.translate((Math.random() - 0.5) * 14 * k, (Math.random() - 0.5) * 10 * k);
  }

  for (let i = 0; i < n; i++) {
    const x = i * laneW;
    ctx.save();
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.fillRect(x, 0, laneW, height);
    }
    ctx.strokeStyle = "rgba(6,95,70,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < fruits.length; i++) {
    const f = fruits[i];
    const lane = lanes[f.lane];
    if (!lane) continue;
    drawFruit(ctx, f, lane.def.accent, now, laneW);
  }

  for (let i = 0; i < fx.length; i++) drawFx(ctx, fx[i], now);
  drawParticles(ctx, particles);
  drawPopups(ctx, popups, now);
  drawTrails(ctx, trails, now);
  ctx.restore();

  // Kartu header (maskot + nama + skor + soal) digambar PALING ATAS:
  // buah meluncur dari balik kartu, tidak pernah menimpa maskot/soal.
  for (let i = 0; i < n; i++) {
    const lane = lanes[i];
    if (!lane) continue;
    drawHud(ctx, lane, i * laneW + 10, 10, Math.max(60, laneW - 20), now);
  }

  // garis tanah
  ctx.save();
  ctx.strokeStyle = "rgba(132,204,22,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, height - 2);
  ctx.lineTo(width, height - 2);
  ctx.stroke();
  ctx.restore();
}

/* ---------------------------------------------------------------- fisika */

export interface StepResult {
  fruits: Fruit[];
  particles: Particle[];
  /** buah yang jatuh melewati dasar tanpa dipotong (objek utuh) */
  missed: Fruit[];
}

/**
 * Memajukan fisika satu langkah. `dt` dalam detik, dibatasi agar tab yang
 * lama tidak aktif tidak melompat jauh.
 */
export function stepPhysics(
  fruits: Fruit[],
  particles: Particle[],
  dt: number,
  width: number,
  height: number,
): StepResult {
  const step = Math.min(dt, 0.05);
  const groundY = height + 60;

  const keptFruits: Fruit[] = [];
  const missed: Fruit[] = [];

  for (let i = 0; i < fruits.length; i++) {
    const f = fruits[i];
    const next: Fruit = {
      ...f,
      y: f.y + f.vy * step,
      pop: Math.max(0, f.pop - step * 3.2),
    };
    if (next.y - next.h / 2 > groundY) {
      missed.push(next);
      continue;
    }
    if (next.x < next.w / 2 + 6 || next.x > width - next.w / 2 - 6) {
      next.x = Math.min(Math.max(next.x, next.w / 2 + 6), width - next.w / 2 - 6);
    }
    keptFruits.push(next);
  }

  const keptParticles: Particle[] = [];
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const life = p.life - step;
    if (life <= 0) continue;
    keptParticles.push({
      ...p,
      x: p.x + p.vx * step,
      y: p.y + p.vy * step,
      vy: p.vy + 260 * step,
      life,
    });
  }

  return { fruits: keptFruits, particles: keptParticles, missed };
}

/** Partikel ledakan kecil; jumlah dibatasi RULES.maxParticles. */
export function burst(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count: number,
): Particle[] {
  const room = RULES.maxParticles - particles.length;
  const n = Math.max(0, Math.min(count, room));
  if (n === 0) return particles;
  const out = particles.slice();
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 170;
    out.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 40,
      life: 0.5 + Math.random() * 0.35,
      maxLife: 0.85,
      color,
      size: 2 + Math.random() * 3.5,
    });
  }
  return out;
}
