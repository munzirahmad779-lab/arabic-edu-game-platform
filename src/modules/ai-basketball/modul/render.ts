/**
 * AI BASKETBALL — arena renderer (canvas 2D, 60 FPS loop).
 *
 * Log 44: LEMPARAN MANUAL oleh siswa (perintah user). Sesudah menjawab
 * benar, maskot tim itu memegang bola dan siswa melemparnya sendiri:
 * tekan bola, geser untuk mengarahkan (titik-titik lintasan tampil),
 * lepaskan untuk melempar — persis game buang sampah sentuh. Fisika
 * sungguhan: gravitasi, pantulan dari bibir ring, lantai dan dinding.
 * Bola masuk -> "score"; meleset -> "miss" (poin diatur Game/logic).
 *
 * Maskot adalah 4 pemeran utama Magguru dari lembar characters/:
 * pose 0 = siaga (wajah bahagia), 1 = terkejut, 3 = hentakan (lempar).
 *
 * Desain ulang visual (poster kartun siang cerah): lapangan berlapis
 * (langit + sinar, bendera, bukit, penonton, papan sponsor, lantai
 * berperspektif + zona tim), papan pantul + lengan penyangga di tiap
 * ring, label tim digambar di kanvas (sejajar ring di semua lebar),
 * karet ketapel + petunjuk "tarik & lepas". Fisika/aturan TIDAK berubah.
 */

import { PARTICLE_BUDGET, clamp, lerp } from "../lib-pendamping/motion-tokens";
import anoaSheet from "../assets/sprites/characters/anoa_sheet.png";
import maleoSheet from "../assets/sprites/characters/maleo_sheet.png";
import tarsiusSheet from "../assets/sprites/characters/tarsius_sheet.png";
import yakiSheet from "../assets/sprites/characters/yaki_sheet.png";
import hoopAsset from "../assets/sprites/hoop.png";
import ballAsset from "../assets/sprites/ball.png";

export interface HoopPoint {
  /** Pusat bibir ring (relatif arena) + setengah lebar bibir ring. */
  x: number;
  y: number;
  half: number;
}

export type ShotOutcome = "score" | "miss";
export type Mood = "calm" | "tense";
export type MascotId = "tarsius" | "anoa" | "maleo" | "yaki";
export type SideIdx = 0 | 1;

type Mode = "idle" | "aim" | "thrown";
type Pose = "dribble" | "rise" | "cheer" | "confused";

export interface ArenaHandle {
  resize(w: number, h: number): void;
  setMood(mood: Mood): void;
  setMascots(left: MascotId, right: MascotId): void;
  setImpactHandler(cb: ((outcome: ShotOutcome) => void) | null): void;
  /** Maskot sisi itu memegang bola; siswa melempar dengan geseran jari. */
  beginAim(side: SideIdx, onResolve: (result: ShotOutcome) => void): void;
  /** Lemparan otomatis (waktu mengarahkan habis) — lemparan lunak ke ring. */
  autoThrow(side: SideIdx): void;
  /** Lemparan dari kontroler HP: tarikan ketapel ternormalisasi -1..1
   *  (tarik ke bawah = pullY positif), diterjemahkan ke geseran arena. */
  throwRemote(side: SideIdx, pullX: number, pullY: number): void;
  /** Reaksi singkat maskot (jawaban salah -> "confused"). */
  react(side: SideIdx, pose: "cheer" | "confused"): void;
  dispose(): void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  fade: number;
}

interface HoopFx {
  x: number;
  y: number;
  t0: number;
  dur: number;
  outcome: ShotOutcome;
}

interface Rig {
  id: MascotId;
  img: HTMLImageElement;
  mode: Mode;
  pose: Pose;
  poseUntil: number;
  dribblePhase: number;
  lastBouncePhase: number;
  y: number;
  // --- lemparan manual ---
  throwCb: ((result: ShotOutcome) => void) | null;
  dragId: number | null;
  dragX: number;
  dragY: number;
  thrownAt: number;
  resolvedAt: number;
  scored: boolean;
  clanked: boolean;
  restTime: number;
  prevY: number;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    scale: number;
    alpha: number;
  };
  trail: { x: number; y: number; t: number }[];
}

const SHEETS: Record<MascotId, { src: string; facing: "R" | "L" }> = {
  tarsius: { src: tarsiusSheet.src, facing: "R" },
  anoa: { src: anoaSheet.src, facing: "R" },
  maleo: { src: maleoSheet.src, facing: "L" },
  yaki: { src: yakiSheet.src, facing: "L" },
};

const BALL_R = 30; // Log 44: 13→17; Log 47: 22; Log 48: 44; Log 54: 30 (user: yang digedein dikecilin lagi, sedang saja)
const GRAV = 1700; // px/detik^2
const LAUNCH_K = 6.4; // pengali geseran -> kecepatan lempar
const MAX_SPEED = 2350;
/* Log 55: ring & bola kini GAMBAR FOTO (hoop.png / ball.png, hasil
 * generate AI + chroma-key). Konstanta hoop.png terukur dari pikselnya:
 * pusat bibir ring di (0.5000, 0.2317) ukuran gambar, lebar bibir ring
 * 0.8333 lebar gambar. Kedalaman jaring dihitung per tata letak. */

const TAU = Math.PI * 2;
/** Warna tim: kiri biru langit, kanan amber. */
const SIDE_HEX = ["#0284C7", "#D97706"] as const;
const SIDE_RGB = ["2,132,199", "217,119,6"] as const;

/** Jalur persegi bersudut membulat (tanpa bergantung pada ctx.roundRect). */
function rr(c: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number, r: number): void {
  const rad = Math.max(0, Math.min(r, bw / 2, bh / 2));
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + bw, y, x + bw, y + bh, rad);
  c.arcTo(x + bw, y + bh, x, y + bh, rad);
  c.arcTo(x, y + bh, x, y, rad);
  c.arcTo(x, y, x + bw, y, rad);
  c.closePath();
}

/** Lingkaran sebagai sub-jalur (untuk awan gabungan). */
function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.moveTo(x + r, y);
  c.arc(x, y, r, 0, TAU);
}

function makeRig(id: MascotId): Rig {
  const img = new Image();
  img.src = SHEETS[id].src;
  return {
    id,
    img,
    mode: "idle",
    pose: "dribble",
    poseUntil: 0,
    dribblePhase: Math.random() * 2,
    lastBouncePhase: 0,
    y: 0,
    throwCb: null,
    dragId: null,
    dragX: 0,
    dragY: 0,
    thrownAt: 0,
    resolvedAt: 0,
    scored: false,
    clanked: false,
    restTime: 0,
    prevY: 0,
    ball: { x: 0, y: 0, vx: 0, vy: 0, angle: 0, scale: 1, alpha: 1 },
    trail: [],
  };
}

export function createArena(canvas: HTMLCanvasElement): ArenaHandle {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    // Kanvas tidak didukung — handle no-op agar game tetap bisa jalan:
    // lemparan dianggap meleset (jawaban benar tetap bernilai 1 poin).
    return {
      resize: () => undefined,
      setMood: () => undefined,
      setMascots: () => undefined,
      setImpactHandler: () => undefined,
      beginAim: (_s, cb) => cb("miss"),
      autoThrow: () => undefined,
      throwRemote: () => undefined,
      react: () => undefined,
      dispose: () => undefined,
    };
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;
  canvas.style.touchAction = "none";

  let w = canvas.clientWidth || 320;
  let h = canvas.clientHeight || 240;
  let dpr = 1;
  let raf = 0;
  let disposed = false;
  let mood: Mood = "calm";
  let sweatAt = 0;
  let lastFrame = 0;
  let impactCb: ((outcome: ShotOutcome) => void) | null = null;
  const hoopImg = new Image();
  hoopImg.src = hoopAsset.src;
  const ballImg = new Image();
  ballImg.src = ballAsset.src;
  const particles: Particle[] = [];
  const hoopFx: HoopFx[] = [];

  // Awan melayang pelan di langit (x = fraksi lebar, y = fraksi tinggi langit).
  const clouds = [
    { x: 0.1, y: 0.3, s: 1.0, v: 0.006 },
    { x: 0.42, y: 0.12, s: 0.75, v: 0.004 },
    { x: 0.7, y: 0.4, s: 1.15, v: 0.005 },
    { x: 0.93, y: 0.18, s: 0.8, v: 0.0035 },
  ];

  // Dua maskot: indeks 0 = tim kiri, 1 = tim kanan.
  const rigs: [Rig, Rig] = [makeRig("anoa"), makeRig("maleo")];

  // Latar statis digambar sekali ke offscreen (canvas berlapis — jaga 60 FPS).
  let court: HTMLCanvasElement | null = null;

  function floorY(): number {
    return h - 30;
  }

  /** Ukuran maskot mengikuti lebar DAN tinggi arena (bayangkan TV besar di
   *  kelas, tetapi arena pendek tidak boleh membuat maskot menabrak ring). */
  function sizeNow(): number {
    const byW = w >= 1250 ? 320 : w >= 900 ? 296 : w >= 560 ? 248 : 168;
    return Math.max(120, Math.min(byW, Math.round(h * 0.56)));
  }

  /** Jarak bola dari pusat maskot (di depannya, searah hadap). */
  function dxNow(): number {
    return Math.round(sizeNow() * 0.38);
  }

  function rigX(side: SideIdx): number {
    // Arena sempit (HP): maskot digeser ke tepi supaya bola dribel kedua
    // maskot tidak bertemu di tengah.
    const fx = w < 560 ? 0.25 : 0.3;
    return side === 0 ? w * fx : w * (1 - fx);
  }

  /** Arah gambar maskot di layarnya: kiri menghadap kanan, kanan menghadap kiri. */
  function drawnFacing(side: SideIdx): "R" | "L" {
    return side === 0 ? "R" : "L";
  }

  function faceDir(side: SideIdx): number {
    return drawnFacing(side) === "R" ? 1 : -1;
  }

  /** Posisi bola di tangan maskot saat mengarahkan lemparan. */
  function holdPos(side: SideIdx): { x: number; y: number } {
    return {
      x: rigX(side) + faceDir(side) * dxNow(),
      y: floorY() - Math.round(sizeNow() * 0.55),
    };
  }

  /** Tata letak gambar ring untuk satu sisi: bibir ring tepat di atas
   *  maskot penembaknya, ukuran mengikuti lebar arena (Log 55). */
  function hoopLayout(side: SideIdx): {
    cx: number;
    cy: number;
    half: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    depth: number;
  } {
    const half = clamp(Math.round(w * 0.065), 34, 66);
    const cx = rigX(side);
    const cy = clamp(Math.round(h * 0.13), 54, 118);
    const dw = (half * 2) / 0.8333;
    const dh = dw * (654 / 708);
    return {
      cx,
      cy,
      half,
      dx: cx - 0.5 * dw,
      dy: cy - 0.2317 * dh,
      dw,
      dh,
      depth: Math.max(30, Math.round(dh * (1 - 0.2317))),
    };
  }

  function rimOf(side: SideIdx): { x: number; y: number; half: number; win: number; depth: number } {
    const L = hoopLayout(side);
    return { x: L.cx, y: L.cy, half: L.half, win: clamp(L.half - BALL_R + 2, 12, 64), depth: L.depth };
  }

  function buildCourt(): void {
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(w * dpr));
    off.height = Math.max(1, Math.round(h * dpr));
    const c = off.getContext("2d");
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = clamp(w / 1000, 0.75, 1.5);
    const floorTop = floorY() - clamp(Math.round(h * 0.16), 48, 120);
    const boardH = Math.round(30 * s);
    const boardTop = floorTop - boardH;

    // ---- langit ----
    const sky = c.createLinearGradient(0, 0, 0, boardTop);
    sky.addColorStop(0, "#38BDF8");
    sky.addColorStop(0.55, "#7DD3FC");
    sky.addColorStop(1, "#E0F2FE");
    c.fillStyle = sky;
    c.fillRect(0, 0, w, boardTop + 2);

    // ---- sinar matahari dari tengah atas ----
    c.save();
    c.beginPath();
    c.rect(0, 0, w, boardTop);
    c.clip();
    c.fillStyle = "rgba(255,255,255,0.14)";
    const rays = 16;
    const R = Math.hypot(w, h) * 1.2;
    for (let i = 0; i < rays; i += 2) {
      const a0 = Math.PI * 0.08 + (i / rays) * Math.PI * 0.84;
      const a1 = Math.PI * 0.08 + ((i + 1) / rays) * Math.PI * 0.84;
      c.beginPath();
      c.moveTo(w / 2, -12);
      c.lineTo(w / 2 + Math.cos(a0) * R, -12 + Math.sin(a0) * R);
      c.lineTo(w / 2 + Math.cos(a1) * R, -12 + Math.sin(a1) * R);
      c.closePath();
      c.fill();
    }
    const sun = c.createRadialGradient(w / 2, -10, 6, w / 2, -10, h * 0.85);
    sun.addColorStop(0, "rgba(254,249,195,0.95)");
    sun.addColorStop(0.28, "rgba(254,240,138,0.4)");
    sun.addColorStop(1, "rgba(254,240,138,0)");
    c.fillStyle = sun;
    c.fillRect(0, 0, w, boardTop);
    c.fillStyle = "#FEF08A";
    c.beginPath();
    c.arc(w / 2, -6, 54 * s, 0, TAU);
    c.fill();
    c.restore();

    // ---- bendera segitiga warna-warni ----
    const seg = 170 * s;
    const flagColors = ["#F97316", "#FACC15", "#22C55E", "#3B82F6", "#EC4899"];
    c.strokeStyle = "rgba(15,23,42,0.45)";
    c.lineWidth = 1.5;
    let ci = 0;
    for (let x0 = -seg / 2; x0 < w + seg; x0 += seg) {
      const x1 = x0 + seg;
      const y0 = 6 * s;
      const cx = (x0 + x1) / 2;
      const cy = y0 + 52 * s;
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(cx, cy, x1, y0);
      c.stroke();
      for (let k = 1; k <= 6; k++) {
        const t = k / 7;
        const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
        const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y0;
        c.fillStyle = flagColors[ci++ % flagColors.length];
        c.beginPath();
        c.moveTo(px - 8 * s, py);
        c.lineTo(px + 8 * s, py);
        c.lineTo(px, py + 17 * s);
        c.closePath();
        c.fill();
      }
    }

    // ---- bukit berlapis ----
    const hillBase = boardTop + 4;
    const hill = (color: string, hmul: number, ph: number): void => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, hillBase);
      for (let x = 0; x <= w + 8; x += 8) {
        const k = 0.5 + 0.28 * Math.sin(x / (w * 0.1) + ph) + 0.22 * Math.sin(x / (w * 0.037) + ph * 2.3);
        c.lineTo(x, hillBase - hmul * k);
      }
      c.lineTo(w, hillBase);
      c.closePath();
      c.fill();
    };
    hill("#BBF7D0", h * 0.2, 0.4);
    hill("#86EFAC", h * 0.12, 2.1);

    // ---- penonton (dua baris) ----
    const heads = ["#FDE68A", "#FCD9B6", "#E0B48A", "#C68E5F", "#8D5A3B"];
    const shirts = ["#F97316", "#22C55E", "#3B82F6", "#EC4899", "#EAB308", "#A855F7", "#EF4444"];
    for (let row = 1; row >= 0; row--) {
      const r = (6.5 - row * 0.6) * s;
      const y = boardTop - 7 * s - row * 9 * s;
      let i = 0;
      for (let x = row * 10 * s; x < w + 20; x += 19 * s) {
        c.fillStyle = shirts[(i * 7 + row * 3) % shirts.length];
        c.beginPath();
        c.ellipse(x, y + r * 2.3, r * 1.6, r * 1.5, 0, Math.PI, TAU);
        c.fill();
        c.fillStyle = heads[(i * 3 + row) % heads.length];
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fill();
        i += 1;
      }
    }

    // ---- papan sponsor ----
    const bg = c.createLinearGradient(0, boardTop, 0, floorTop);
    bg.addColorStop(0, "#0EA5E9");
    bg.addColorStop(1, "#0369A1");
    c.fillStyle = bg;
    c.fillRect(0, boardTop, w, boardH);
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.fillRect(0, boardTop, w, 2 * s);
    c.fillStyle = "rgba(0,0,0,0.18)";
    c.fillRect(0, floorTop - 3 * s, w, 3 * s);
    const step = 150 * s;
    c.font = `900 ${Math.round(boardH * 0.5)}px system-ui, sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    let bi = 0;
    for (let x = step / 2; x < w + step; x += step) {
      c.fillStyle = bi % 2 === 0 ? "#FDE047" : "#FFFFFF";
      c.fillText(bi % 2 === 0 ? "MAGGURU" : "★ KUIS BASKET ★", x, boardTop + boardH / 2 + 1);
      bi += 1;
    }

    // ---- lantai berperspektif ----
    const floor = c.createLinearGradient(0, floorTop, 0, h);
    floor.addColorStop(0, "#FDE0B0");
    floor.addColorStop(1, "#F2A33A");
    c.fillStyle = floor;
    c.fillRect(0, floorTop, w, h - floorTop);

    c.save();
    c.beginPath();
    c.rect(0, floorTop, w, h - floorTop);
    c.clip();
    // papan lantai memusat ke tengah horizon
    c.strokeStyle = "rgba(146,64,14,0.16)";
    c.lineWidth = 1.5;
    const n = Math.ceil(w / (2 * 34 * s)) + 1;
    for (let i = -n; i <= n; i++) {
      c.beginPath();
      c.moveTo(w / 2 + i * 34 * s, floorTop);
      c.lineTo(w / 2 + i * 68 * s, h);
      c.stroke();
    }
    // sambungan melintang
    c.strokeStyle = "rgba(146,64,14,0.09)";
    for (let k = 1; k <= 5; k++) {
      const y = floorTop + (h - floorTop) * Math.pow(k / 6, 1.6);
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    // bayangan papan sponsor jatuh ke lantai
    const castShadow = c.createLinearGradient(0, floorTop, 0, floorTop + 22 * s);
    castShadow.addColorStop(0, "rgba(120,53,15,0.22)");
    castShadow.addColorStop(1, "rgba(120,53,15,0)");
    c.fillStyle = castShadow;
    c.fillRect(0, floorTop, w, 22 * s);

    // zona tim di bawah tiap maskot (biru kiri, amber kanan)
    for (const side of [0, 1] as SideIdx[]) {
      const x = rigX(side);
      const rx = Math.round(sizeNow() * 0.52);
      const ry = clamp(rx * 0.14, 14, 26);
      c.fillStyle = side === 0 ? "rgba(14,165,233,0.30)" : "rgba(245,158,11,0.36)";
      c.beginPath();
      c.ellipse(x, floorY() + 4, rx, ry, 0, 0, TAU);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.85)";
      c.lineWidth = 3;
      c.stroke();
    }

    // garis lapangan putih
    c.strokeStyle = "rgba(255,255,255,0.92)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, floorTop + 1.5);
    c.lineTo(w, floorTop + 1.5);
    c.stroke();
    const ccx = w / 2;
    const ccy = floorTop + (h - floorTop) * 0.52;
    const crx = Math.min(w * 0.2, 160 * s);
    c.beginPath();
    c.ellipse(ccx, ccy, crx, crx * 0.2, 0, 0, TAU);
    c.stroke();
    c.beginPath();
    c.moveTo(ccx, floorTop + 1.5);
    c.lineTo(ccx, ccy - crx * 0.2);
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.18)";
    c.beginPath();
    c.ellipse(ccx, ccy, crx * 0.45, crx * 0.09, 0, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, h - 8);
    c.lineTo(w, h - 8);
    c.stroke();
    c.restore();

    court = off;
  }

  function parkBall(rig: Rig, side: SideIdx): void {
    rig.ball.vx = 0;
    rig.ball.vy = 0;
    rig.ball.scale = 1;
    rig.ball.alpha = 1;
    rig.ball.x = rigX(side) + faceDir(side) * dxNow();
    rig.ball.y = floorY() - BALL_R;
  }

  function resize(nextW: number, nextH: number): void {
    w = Math.max(240, nextW);
    h = Math.max(180, nextH);
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildCourt();
    rigs.forEach((rig, i) => {
      if (rig.mode === "idle") parkBall(rig, i as SideIdx);
    });
  }

  function spawnBurst(
    x: number,
    y: number,
    count: number,
    colors: readonly string[],
    opts: { speedMin: number; speedMax: number; up: boolean; gravity: number; life: number },
  ): void {
    for (let i = 0; i < count && particles.length < PARTICLE_BUDGET; i++) {
      const a = opts.up
        ? -Math.PI / 2 + (Math.random() - 0.5) * 1.1
        : Math.random() * Math.PI * 2;
      const speed = lerp(opts.speedMin, opts.speedMax, Math.random());
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: opts.life * (0.7 + Math.random() * 0.5),
        maxLife: opts.life,
        size: 2 + Math.random() * 3.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: opts.gravity,
        fade: 1,
      });
    }
  }

  const GOLD = ["#FBBF24", "#F59E0B", "#FDE68A", "#fff7d6"];
  const SPARK = ["#f8fafc", "#FBBF24", "#fb923c"];
  const DUST = ["rgba(148,163,184,0.5)", "rgba(100,116,139,0.4)"];
  const SWEAT = ["rgba(147,197,253,0.85)"];

  // ================= LEMPARAN =================
  function resolveThrow(rig: Rig, result: ShotOutcome, now: number): void {
    if (!rig.throwCb) return;
    const cb = rig.throwCb;
    rig.throwCb = null;
    rig.resolvedAt = now;
    (window as Window & { __basketResult?: string }).__basketResult = result;
    rig.pose = result === "score" ? "cheer" : "confused";
    rig.poseUntil = now + 950;
    cb(result);
  }

  function launch(rig: Rig, side: SideIdx, vx: number, vy: number, now: number): void {
    const hp = holdPos(side);
    // Kait uji (inert, tanpa UI): lemparan terakhir yang dilepas, supaya
    // uji otomatis bisa memverifikasi kecepatan & titik pegang persis.
    const rimDbg = rimOf(side);
    (window as Window & { __basketThrow?: { vx: number; vy: number; holdX: number; holdY: number; rimX: number; rimY: number } }).__basketThrow = {
      vx,
      vy,
      holdX: hp.x,
      holdY: hp.y,
      rimX: rimDbg.x,
      rimY: rimDbg.y,
    };
    rig.ball.x = hp.x;
    rig.ball.y = hp.y;
    rig.ball.vx = vx;
    rig.ball.vy = vy;
    rig.mode = "thrown";
    rig.thrownAt = now;
    rig.resolvedAt = 0;
    rig.scored = false;
    rig.clanked = false;
    rig.restTime = 0;
    rig.prevY = hp.y;
    rig.pose = "rise";
    rig.poseUntil = now + 480;
  }

  function beginAim(side: SideIdx, onResolve: (result: ShotOutcome) => void): void {
    const rig = rigs[side];
    rig.mode = "aim";
    rig.throwCb = onResolve;
    rig.dragId = null;
    rig.pose = "dribble";
    rig.poseUntil = 0;
    const hp = holdPos(side);
    rig.ball.x = hp.x;
    rig.ball.y = hp.y;
    rig.ball.vx = 0;
    rig.ball.vy = 0;
  }

  function autoThrow(side: SideIdx): void {
    const rig = rigs[side];
    if (rig.mode !== "aim") return;
    const rim = rimOf(side);
    const hp = holdPos(side);
    if (!rim) {
      resolveThrow(rig, "miss", performance.now());
      return;
    }
    // Lemparan lunak terarah: waktu terbang 0,95 dtk + acak kecil di
    // dalam jendela masuk, supaya kadang masuk kadang meleset.
    const T = 0.95;
    const tx = rim.x + (Math.random() * 2 - 1) * Math.min(28, rim.win * 0.6);
    const vx = (tx - hp.x) / T;
    const vy = (rim.y - hp.y) / T - 0.5 * GRAV * T;
    launch(rig, side, vx, vy, performance.now());
  }

  /** Tarikan penuh pada pad HP (pull 1) setara geseran 280 px di arena,
   *  cukup untuk kecepatan lemparan masuk pada geometri ring saat ini. */
  const REMOTE_PULL_PX = 280;

  function throwRemote(side: SideIdx, pullX: number, pullY: number): void {
    const rig = rigs[side];
    if (rig.mode !== "aim") return;
    const dx = -pullX * REMOTE_PULL_PX;
    const dy = -pullY * REMOTE_PULL_PX;
    if (Math.hypot(dx, dy) < 26) return; // tarikan terlalu kecil — batal
    let vx = dx * LAUNCH_K;
    let vy = dy * LAUNCH_K;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_SPEED) {
      vx = (vx / speed) * MAX_SPEED;
      vy = (vy / speed) * MAX_SPEED;
    }
    launch(rig, side, vx, vy, performance.now());
  }

  function react(side: SideIdx, pose: "cheer" | "confused"): void {
    const rig = rigs[side];
    if (rig.mode !== "idle") return;
    rig.pose = pose;
    rig.poseUntil = performance.now() + 800;
  }

  // ---- geseran jari / tetikus (slingshot dengan pratinjau lintasan) ----
  function eventPos(e: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: PointerEvent): void {
    const pos = eventPos(e);
    for (let s = 0 as SideIdx; s < 2; s = (s + 1) as SideIdx) {
      const rig = rigs[s];
      if (rig.mode !== "aim" || rig.dragId !== null) continue;
      const hp = holdPos(s);
      const d = Math.hypot(pos.x - hp.x, pos.y - hp.y);
      if (d <= 100) {
        rig.dragId = e.pointerId;
        rig.dragX = pos.x;
        rig.dragY = pos.y;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* abaikan — geseran tetap diikuti lewat move */
        }
        e.preventDefault();
        return;
      }
    }
  }

  function onPointerMove(e: PointerEvent): void {
    for (const rig of rigs) {
      if (rig.dragId === e.pointerId) {
        const pos = eventPos(e);
        rig.dragX = pos.x;
        rig.dragY = pos.y;
        return;
      }
    }
  }

  function onPointerUp(e: PointerEvent): void {
    for (let s = 0 as SideIdx; s < 2; s = (s + 1) as SideIdx) {
      const rig = rigs[s];
      if (rig.dragId !== e.pointerId) continue;
      rig.dragId = null;
      const hp = holdPos(s);
      const dx = hp.x - rig.dragX;
      const dy = hp.y - rig.dragY;
      const dist = Math.hypot(dx, dy);
      if (dist < 26) return; // ketukan kecil — batal, tetap mengarahkan
      let vx = dx * LAUNCH_K;
      let vy = dy * LAUNCH_K;
      const speed = Math.hypot(vx, vy);
      if (speed > MAX_SPEED) {
        vx = (vx / speed) * MAX_SPEED;
        vy = (vy / speed) * MAX_SPEED;
      }
      launch(rig, s, vx, vy, performance.now());
      return;
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  // ================= UPDATE =================
  /** Pantulan bola dari dua ujung bibir sebuah ring (dipakai ring sendiri
   *  & ring lawan). Radius tabrak sedikit di bawah jari-jari bola supaya
   *  bola yang jatuh lurus di jendela masuk tidak tersenggol bibir. */
  function collideRimDiscs(rig: Rig, geo: { x: number; y: number; half: number }): void {
    const ball = rig.ball;
    // Log 56: titik tepi lebih ramping (22) supaya kontak bola tampak
    // menyentuh besi ring gambar, bukan mengambang jauh di atasnya.
    const DISC_R = 22;
    for (const ex of [geo.x - geo.half, geo.x + geo.half]) {
      const d = Math.hypot(ball.x - ex, ball.y - geo.y);
      if (d < DISC_R && d > 0.01) {
        const nx = (ball.x - ex) / d;
        const ny = (ball.y - geo.y) / d;
        ball.x = ex + nx * DISC_R;
        ball.y = geo.y + ny * DISC_R;
        const dot2 = ball.vx * nx + ball.vy * ny;
        if (dot2 < 0) {
          ball.vx -= 1.52 * dot2 * nx;
          ball.vy -= 1.52 * dot2 * ny;
          ball.vx *= 0.86;
          ball.vy *= 0.86;
          // Pantulan harus TEGAS: bola tidak boleh bergetar/duduk di
          // titik tepi — bila sesudah pantul kecepatannya kecil, dorong
          // keluar menjauhi titik tepi (Log 56).
          const spd = Math.hypot(ball.vx, ball.vy);
          if (spd < 240) {
            if (spd > 1) {
              ball.vx = (ball.vx / spd) * 240;
              ball.vy = (ball.vy / spd) * 240;
            } else {
              ball.vx = nx * 240;
              ball.vy = ny * 240;
            }
          }
          if (!rig.clanked) {
            rig.clanked = true;
            if (impactCb) impactCb("miss");
            spawnBurst(ball.x, ball.y, 10, SPARK, { speedMin: 80, speedMax: 220, up: false, gravity: 460, life: 0.5 });
          }
        }
      }
    }
  }

  function updateRig(rig: Rig, side: SideIdx, now: number, dt: number): void {
    const speed = mood === "tense" ? 1.55 : 1;
    rig.dribblePhase += dt * 6.2 * speed;
    if (Math.floor(rig.dribblePhase) !== Math.floor(rig.lastBouncePhase)) {
      rig.lastBouncePhase = rig.dribblePhase;
      if (rig.mode === "idle" && particles.length < PARTICLE_BUDGET - 6) {
        spawnBurst(rig.ball.x, floorY() - 2, 3, DUST, {
          speedMin: 18,
          speedMax: 46,
          up: true,
          gravity: 240,
          life: 0.45,
        });
      }
    }
    if (rig.poseUntil && now > rig.poseUntil && rig.mode !== "thrown") {
      rig.pose = "dribble";
      rig.poseUntil = 0;
    }

    const ball = rig.ball;
    rig.y = floorY() - 62;

    if (rig.mode === "idle") {
      const bounce = Math.abs(Math.sin(rig.dribblePhase * Math.PI));
      ball.x = rigX(side) + faceDir(side) * dxNow();
      ball.y = lerp(floorY() - BALL_R - 4, floorY() - 104, bounce);
      ball.angle += dt * 7 * speed;
      return;
    }

    if (rig.mode === "aim") {
      const hp = holdPos(side);
      let bx = hp.x;
      let by = hp.y + Math.sin(now / 320) * 3;
      if (rig.dragId !== null) {
        // Bola ikut tertarik sedikit mengikuti geseran (tegangan ketapel)
        bx += clamp((rig.dragX - hp.x) * 0.16, -30, 30);
        by += clamp((rig.dragY - hp.y) * 0.16, -30, 30);
      }
      ball.x = bx;
      ball.y = by;
      ball.angle += dt * 1.2;
      return;
    }

    // mode "thrown" — fisika bebas
    rig.prevY = ball.y;
    ball.vy += GRAV * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.angle += dt * (Math.sign(ball.vx) || 1) * (3 + Math.abs(ball.vx) * 0.005);
    rig.trail.push({ x: ball.x, y: ball.y, t: now });

    const rim = rimOf(side);
    if (rim && !rig.scored && !rig.resolvedAt) {
      // MASUK: bola jatuh melintasi bidang bibir ring dalam jendela
      // tengah (Log 56: jendela komitmen diperlebar +12 — lemparan anak
      // yang mengenai dekat tengah langsung masuk mulus, tidak lagi
      // berputar-putar di bibir ring)
      if (ball.vy > 0 && rig.prevY <= rim.y && ball.y >= rim.y && Math.abs(ball.x - rim.x) <= rim.win + 12) {
        rig.scored = true;
        // Log 56: bola DIKOMITKAN masuk jaring — diluruskan ke tengah
        // bibir dan dijatuhkan tembus. Tanpa ini bola bisa mengambang/
        // duduk di bibir ring sesudah dinyatakan masuk (terlihat aneh).
        ball.x = rim.x;
        ball.vx = 0;
        ball.vy = Math.max(ball.vy, 140);
        rig.pose = "cheer";
        rig.poseUntil = now + 1100;
        hoopFx.push({ x: rim.x, y: rim.y, t0: now, dur: 700, outcome: "score" });
        if (impactCb) impactCb("score");
        spawnBurst(rim.x, rim.y + 8, 26, GOLD, { speedMin: 130, speedMax: 330, up: true, gravity: -60, life: 1.1 });
        spawnBurst(rim.x, rim.y + 6, 10, GOLD, { speedMin: 40, speedMax: 130, up: false, gravity: 320, life: 0.8 });
      } else {
        collideRimDiscs(rig, rim);
      }
    }

    // RING LAWAN TERTUTUP untuk bola ini (Log 49, perintah user: siswa
    // jangan sampai salah memasukkan bola). Bibirnya memantulkan bola
    // seperti ring sendiri, dan bidang mulutnya tertutup: bola yang
    // jatuh ke arah mulut ring lawan terpantul balik ke atas, tidak
    // bisa menembus masuk. Skor memang hanya dihitung dari ring
    // sendiri, tetapi kini salah ring pun mustahil secara fisika.
    const wrong = rimOf((1 - side) as SideIdx);
    if (wrong && !rig.scored && !rig.resolvedAt) {
      collideRimDiscs(rig, wrong);
      // Kolom jaring lawan = kotak padat (AABB dari bibir ring sampai
      // dasar jaring): bola tidak bisa masuk dari atas, samping, atau
      // bawah — memantul keluar ke segala arah.
      const rx0 = wrong.x - wrong.half;
      const rx1 = wrong.x + wrong.half;
      const ry0 = wrong.y;
      const ry1 = wrong.y + wrong.depth;
      const cx = clamp(ball.x, rx0, rx1);
      const cy = clamp(ball.y, ry0, ry1);
      const ddx = ball.x - cx;
      const ddy = ball.y - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < BALL_R * BALL_R) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          const nx = ddx / d;
          const ny = ddy / d;
          ball.x = cx + nx * BALL_R;
          ball.y = cy + ny * BALL_R;
          const dot2 = ball.vx * nx + ball.vy * ny;
          if (dot2 < 0) {
            ball.vx -= 1.6 * dot2 * nx;
            ball.vy -= 1.6 * dot2 * ny;
            ball.vx *= 0.8;
            ball.vy *= 0.8;
          }
        } else {
          // Pusat bola telanjur di dalam kotak: dorong keluar ke atas.
          ball.y = ry0 - BALL_R;
          if (ball.vy > 0) ball.vy = -Math.abs(ball.vy) * 0.45;
        }
        if (!rig.clanked) {
          rig.clanked = true;
          if (impactCb) impactCb("miss");
          spawnBurst(ball.x, Math.max(ball.y, ry0), 8, SPARK, { speedMin: 80, speedMax: 200, up: true, gravity: 380, life: 0.45 });
        }
      }
    }

    // Di dalam jaring: bola dikunci di tengah & diredam (Log 56: kunci
    // penuh, bukan lerp longgar, supaya bola meluncur lurus menembus
    // jaring dan keluar tepat di bawahnya)
    if (rim && rig.scored && ball.y > rim.y && ball.y < rim.y + rim.depth) {
      ball.x = rim.x;
      ball.vx = 0;
      if (ball.vy > 260) ball.vy = 260;
    }

    // Lantai & dinding
    if (ball.y > floorY() - BALL_R) {
      ball.y = floorY() - BALL_R;
      if (Math.abs(ball.vy) > 120) {
        spawnBurst(ball.x, floorY() - 2, 3, DUST, { speedMin: 16, speedMax: 40, up: true, gravity: 240, life: 0.4 });
      }
      // Log 56: bola yang sudah dinilai (resolvedAt terisi) adalah bola
      // mati — pantulannya dilunakkan supaya tidak terbang naik lagi
      // menembus jaring dari bawah (itu yang terlihat aneh di video).
      ball.vy = -Math.abs(ball.vy) * (rig.resolvedAt ? 0.22 : 0.55);
      ball.vx *= rig.resolvedAt ? 0.7 : 0.82;
      if (Math.abs(ball.vy) < 60) ball.vy = 0;
    }
    if (ball.x < BALL_R) {
      ball.x = BALL_R;
      ball.vx = Math.abs(ball.vx) * 0.62;
    } else if (ball.x > w - BALL_R) {
      ball.x = w - BALL_R;
      ball.vx = -Math.abs(ball.vx) * 0.62;
    }

    // Penyelesaian lemparan
    if (rig.throwCb) {
      if (rig.scored && rim && ball.y > rim.y + rim.depth + 4) {
        resolveThrow(rig, "score", now);
      } else if (!rig.scored) {
        const resting =
          ball.y >= floorY() - BALL_R - 1 && Math.abs(ball.vx) < 70 && ball.vy === 0;
        rig.restTime = resting ? rig.restTime + dt : 0;
        if (rig.restTime > 0.35 || now - rig.thrownAt > 4200) {
          resolveThrow(rig, "miss", now);
        }
      } else if (now - rig.thrownAt > 4200) {
        resolveThrow(rig, "score", now);
      }
    } else if (rig.resolvedAt && now - rig.resolvedAt > 1500) {
      // Bola sisa pantulan sudah cukup lama — parkir & kembali dribel
      rig.mode = "idle";
      rig.resolvedAt = 0;
      parkBall(rig, side);
    }

    for (let i = rig.trail.length - 1; i >= 0; i--) {
      if (now - rig.trail[i].t > 260) rig.trail.splice(i, 1);
    }
  }

  function update(now: number, dt: number): void {
    // Keringat saat detik kritis — dari kedua maskot bergantian
    if (mood === "tense" && now > sweatAt) {
      sweatAt = now + 620;
      const side = (Math.floor(now / 620) % 2) as SideIdx;
      spawnBurst(rigX(side) + faceDir(side) * Math.round(sizeNow() * 0.27), floorY() - Math.round(sizeNow() * 1.08), 1, SWEAT, {
        speedMin: 10,
        speedMax: 34,
        up: false,
        gravity: 420,
        life: 0.7,
      });
    }

    updateRig(rigs[0], 0, now, dt);
    updateRig(rigs[1], 1, now, dt);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = hoopFx.length - 1; i >= 0; i--) {
      if (now - hoopFx[i].t0 > hoopFx[i].dur) hoopFx.splice(i, 1);
    }
  }

  // ================= DRAW =================
  function drawClouds(c: CanvasRenderingContext2D, dt: number): void {
    const s = clamp(w / 1000, 0.75, 1.5);
    for (const k of clouds) {
      k.x += k.v * dt;
      if (k.x > 1.15) k.x = -0.15;
      const cx = k.x * w;
      const cy = 52 * s + k.y * h * 0.32;
      const r = 20 * s * k.s;
      c.save();
      c.globalAlpha = 0.93;
      c.fillStyle = "#ffffff";
      c.beginPath();
      dot(c, cx, cy, r);
      dot(c, cx + r * 1.1, cy + r * 0.18, r * 0.8);
      dot(c, cx - r * 1.1, cy + r * 0.22, r * 0.7);
      dot(c, cx + r * 0.3, cy - r * 0.42, r * 0.75);
      c.fill();
      c.fillStyle = "rgba(125,170,205,0.28)";
      c.beginPath();
      c.ellipse(cx, cy + r * 0.72, r * 1.7, r * 0.26, 0, 0, TAU);
      c.fill();
      c.restore();
    }
  }

  function drawBallShadow(c: CanvasRenderingContext2D, rig: Rig): void {
    const ball = rig.ball;
    const height = clamp((floorY() - BALL_R - ball.y) / 220, 0, 1);
    const sw = BALL_R * (1.7 - height * 0.8);
    c.save();
    c.globalAlpha = 0.32 * (1 - height * 0.55) * ball.alpha;
    c.fillStyle = "#000";
    c.beginPath();
    c.ellipse(ball.x, floorY() + 3, sw, sw * 0.32, 0, 0, TAU);
    c.fill();
    c.restore();
  }

  function drawBall(c: CanvasRenderingContext2D, rig: Rig): void {
    const ball = rig.ball;
    if (ball.alpha <= 0.02) return;
    c.save();
    c.globalAlpha = ball.alpha;
    c.translate(ball.x, ball.y);
    c.scale(ball.scale, ball.scale);
    c.rotate(ball.angle);
    // Bola foto (Log 55): tekstur kulit asli yang ikut berputar mengikuti
    // sudut bola — terbangnya terlihat nyata, bukan lingkaran pipih.
    if (ballImg.complete && ballImg.naturalWidth > 0) {
      c.drawImage(ballImg, -BALL_R, -BALL_R, BALL_R * 2, BALL_R * 2);
      c.restore();
      return;
    }
    const g = c.createRadialGradient(-5, -6, 2, 0, 0, BALL_R + 2);
    g.addColorStop(0, "#fdba74");
    g.addColorStop(0.55, "#f97316");
    g.addColorStop(1, "#c2410c");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, BALL_R, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(69,26,3,0.85)";
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(0, 0, BALL_R, 0, TAU);
    c.moveTo(-BALL_R, 0);
    c.lineTo(BALL_R, 0);
    c.moveTo(0, -BALL_R);
    c.lineTo(0, BALL_R);
    c.stroke();
    c.beginPath();
    c.arc(-BALL_R * 1.35, 0, BALL_R * 0.95, -0.7, 0.7);
    c.stroke();
    c.beginPath();
    c.arc(BALL_R * 1.35, 0, BALL_R * 0.95, Math.PI - 0.7, Math.PI + 0.7);
    c.stroke();
    c.restore();
  }

  /** Karet ketapel + titik-titik lintasan saat siswa menggeser bola. */
  function drawAimPreview(c: CanvasRenderingContext2D, rig: Rig, side: SideIdx): void {
    if (rig.mode !== "aim" || rig.dragId === null) return;
    const hp = holdPos(side);
    const dx = hp.x - rig.dragX;
    const dy = hp.y - rig.dragY;
    if (Math.hypot(dx, dy) < 26) return;

    // karet: dari tangan maskot ke titik jari
    c.save();
    c.lineCap = "round";
    c.strokeStyle = `rgba(${SIDE_RGB[side]},0.35)`;
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(hp.x, hp.y);
    c.lineTo(rig.dragX, rig.dragY);
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(hp.x, hp.y);
    c.lineTo(rig.dragX, rig.dragY);
    c.stroke();
    c.fillStyle = `rgba(${SIDE_RGB[side]},0.45)`;
    c.strokeStyle = "#ffffff";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(rig.dragX, rig.dragY, 15, 0, TAU);
    c.fill();
    c.stroke();
    c.restore();

    let vx = dx * LAUNCH_K;
    let vy = dy * LAUNCH_K;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_SPEED) {
      vx = (vx / speed) * MAX_SPEED;
      vy = (vy / speed) * MAX_SPEED;
    }
    let px = hp.x;
    let py = hp.y;
    const pvx = vx;
    let pvy = vy;
    const step = 1 / 30;
    c.save();
    for (let i = 0; i < 30; i++) {
      pvy += GRAV * step;
      px += pvx * step;
      py += pvy * step;
      if (py > floorY() - BALL_R) break;
      if (i % 2 === 0) {
        const t = i / 30;
        const r = 6.5 - t * 3.5;
        c.globalAlpha = 0.95 * (1 - t * 0.7);
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(px, py, r, 0, TAU);
        c.fill();
        c.lineWidth = 2;
        c.strokeStyle = SIDE_HEX[side];
        c.stroke();
      }
    }
    c.restore();
  }

  /** Cincin berdenyut + label di bola yang menunggu dilempar. */
  function drawAimHint(c: CanvasRenderingContext2D, rig: Rig, side: SideIdx, now: number): void {
    if (rig.mode !== "aim") return;
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    const bx = rig.ball.x;
    const by = rig.ball.y;
    c.save();
    c.translate(bx, by);
    c.strokeStyle = `rgba(${SIDE_RGB[side]},${0.55 + 0.35 * pulse})`;
    c.lineWidth = 3.5;
    c.setLineDash([8, 7]);
    c.lineDashOffset = -now / 40;
    c.beginPath();
    c.arc(0, 0, BALL_R + 12 + 4 * pulse, 0, TAU);
    c.stroke();
    c.restore();

    if (rig.dragId === null) {
      const label = "TARIK & LEPAS";
      c.save();
      c.font = "900 13px system-ui, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      const tw = c.measureText(label).width + 20;
      const ly = by - BALL_R - 30 - 3 * pulse;
      c.fillStyle = SIDE_HEX[side];
      rr(c, bx - tw / 2, ly - 12, tw, 24, 12);
      c.fill();
      c.fillStyle = "#ffffff";
      c.fillText(label, bx, ly + 1);
      c.restore();
    }
  }

  function drawMascot(c: CanvasRenderingContext2D, rig: Rig, side: SideIdx, now: number): void {
    const x = rigX(side);
    const fy = floorY();
    // Kaki menapak tanah: isi sprite mencapai tepi bawah sel (terukur
    // bantalan bawah 0), jadi tepi bawah gambar ditaruh tepat di garis
    // lantai + bayangannya. Jangkar lama (fy-62+14) menyisakan celah
    // 48px — itulah sebab maskot terlihat melayang (Log 48).
    const bob = rig.mode === "idle" ? Math.sin(rig.dribblePhase * Math.PI) * 3 : 0;
    // Sorak: lompatan kecil perayaan (pola Log 34) di atas pose bahagia.
    const hop = rig.pose === "cheer" ? Math.abs(Math.sin(now / 170)) * 9 : 0;

    // Bayangan lantai
    c.save();
    c.globalAlpha = 0.34;
    c.fillStyle = "#000";
    c.beginPath();
    c.ellipse(x, fy + 4, Math.round(sizeNow() * 0.34), 10, 0, 0, TAU);
    c.fill();
    c.restore();

    // Cincin penanda di kaki maskot yang sedang memegang bola (mode aim)
    if (rig.mode === "aim") {
      const pulse = 0.6 + 0.4 * Math.sin(now / 240);
      c.save();
      c.strokeStyle = `rgba(${SIDE_RGB[side]},${0.55 * pulse + 0.3})`;
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(x, fy + 4, Math.round(sizeNow() * 0.42), 13, 0, 0, TAU);
      c.stroke();
      c.restore();
    }

    // Pemetaan pose -> frame lembar characters/: lempar = 3,
    // terkejut = 1, siaga & sorak = 0 (wajah bahagia).
    const frameIndex = rig.pose === "rise" ? 3 : rig.pose === "confused" ? 1 : 0;
    const SIZE = sizeNow();
    const cheerPulse = rig.pose === "cheer" ? 1 + Math.sin(now / 90) * 0.03 : 1;
    const flip = SHEETS[rig.id].facing !== drawnFacing(side) ? -1 : 1;

    c.save();
    c.translate(x, fy + 2 + bob - hop);
    c.scale(flip * cheerPulse, cheerPulse);
    if (rig.img.complete && rig.img.naturalWidth > 0) {
      const cell = 256;
      const sx = (frameIndex % 2) * cell;
      const sy = Math.floor(frameIndex / 2) * cell;
      c.drawImage(rig.img, sx, sy, cell, cell, -SIZE / 2, -SIZE, SIZE, SIZE);
    } else {
      // Cadangan selama gambar dimuat: siluet sederhana
      const g = c.createLinearGradient(0, -SIZE, 0, 0);
      g.addColorStop(0, "#fb923c");
      g.addColorStop(1, "#ea580c");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, -SIZE / 2, SIZE * 0.32, SIZE * 0.42, 0, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  function drawHoopFx(c: CanvasRenderingContext2D, now: number): void {
    for (const fx of hoopFx) {
      const t = clamp((now - fx.t0) / fx.dur, 0, 1);
      if (fx.outcome === "score") {
        // Pilar cahaya emas
        const pillarH = 150 * Math.min(1, t * 2.4);
        const g = c.createLinearGradient(fx.x, fx.y, fx.x, fx.y - pillarH);
        g.addColorStop(0, `rgba(251,191,36,${0.5 * (1 - t)})`);
        g.addColorStop(1, "rgba(251,191,36,0)");
        c.fillStyle = g;
        const pw = 84 + 56 * (1 - t);
        c.beginPath();
        c.moveTo(fx.x - pw / 2, fx.y);
        c.lineTo(fx.x + pw / 2, fx.y);
        c.lineTo(fx.x + pw * 0.12, fx.y - pillarH);
        c.lineTo(fx.x - pw * 0.12, fx.y - pillarH);
        c.closePath();
        c.fill();
        // Ring mengembang
        c.strokeStyle = `rgba(253,230,138,${0.85 * (1 - t)})`;
        c.lineWidth = 4;
        c.beginPath();
        c.ellipse(fx.x, fx.y, 56 + 96 * t, 20 + 30 * t, 0, 0, TAU);
        c.stroke();
      } else {
        // Kilat merah dentang
        c.strokeStyle = `rgba(248,113,113,${0.85 * (1 - t)})`;
        c.lineWidth = 5;
        c.beginPath();
        c.ellipse(fx.x, fx.y, 58 + 80 * t, 20 + 26 * t, 0, 0, TAU);
        c.stroke();
        // Garis getar horizontal
        const shake = Math.sin(now / 26) * 5 * (1 - t);
        c.beginPath();
        c.moveTo(fx.x - 80, fx.y - 6 + shake);
        c.lineTo(fx.x + 80, fx.y - 6 - shake);
        c.stroke();
      }
    }
  }

  function drawTrail(c: CanvasRenderingContext2D, rig: Rig, now: number): void {
    for (let i = 0; i < rig.trail.length; i++) {
      const p = rig.trail[i];
      const age = clamp((now - p.t) / 260, 0, 1);
      c.globalAlpha = (1 - age) * 0.38;
      c.fillStyle = "#f97316";
      c.beginPath();
      c.arc(p.x, p.y, BALL_R * (1 - age) * 0.8, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function drawParticles(c: CanvasRenderingContext2D): void {
    for (const p of particles) {
      c.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  /** Papan pantul + lengan penyangga dari atas (ring tidak lagi melayang).
   *  Warna bingkai & label mengikuti tim; label digambar di kanvas supaya
   *  selalu sejajar ring di lebar layar mana pun. */
  function drawBackboard(c: CanvasRenderingContext2D, side: SideIdx): void {
    const L = hoopLayout(side);
    const col = SIDE_HEX[side];
    const bw = L.half * 2.7;
    const top = L.cy - L.half * 1.5;
    const bh = L.half * 1.5 + L.half * 0.16;
    const x = L.cx - bw / 2;

    // lengan penyangga
    const armW = Math.max(8, L.half * 0.2);
    const arm = c.createLinearGradient(L.cx - armW / 2, 0, L.cx + armW / 2, 0);
    arm.addColorStop(0, "#94A3B8");
    arm.addColorStop(0.5, "#E2E8F0");
    arm.addColorStop(1, "#64748B");
    c.fillStyle = arm;
    c.fillRect(L.cx - armW / 2, 0, armW, Math.max(0, top + 4));

    // papan
    c.save();
    c.shadowColor = "rgba(15,23,42,0.28)";
    c.shadowBlur = 12;
    c.shadowOffsetY = 5;
    rr(c, x, top, bw, bh, 10);
    c.fillStyle = "rgba(255,255,255,0.97)";
    c.fill();
    c.restore();
    rr(c, x, top, bw, bh, 10);
    c.lineWidth = Math.max(4, L.half * 0.09);
    c.strokeStyle = col;
    c.stroke();

    // kotak sasaran di atas ring
    const tw = L.half * 1.15;
    const th = L.half * 0.72;
    const ty = L.cy - L.half * 0.78;
    c.lineWidth = Math.max(3, L.half * 0.06);
    c.strokeStyle = col;
    c.strokeRect(L.cx - tw / 2, ty, tw, th);

    // label tim
    c.fillStyle = col;
    c.font = `900 ${Math.round(L.half * 0.36)}px system-ui, sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(side === 0 ? "KIRI" : "KANAN", L.cx, top + (ty - top) / 2 + 1);
  }

  /** Lapisan BELAKANG ring foto (Log 55): papan pantul lalu seluruh
   *  gambar ring digambar sebelum bola, jadi bola yang meluncur turun
   *  tampak masuk ke mulut ring. Lapisan depannya digambar ulang
   *  sesudah bola. */
  function drawHoopsBack(c: CanvasRenderingContext2D): void {
    ([0, 1] as SideIdx[]).forEach((side) => {
      drawBackboard(c, side);
    });
    if (!hoopImg.complete || hoopImg.naturalWidth === 0) return;
    ([0, 1] as SideIdx[]).forEach((side) => {
      const L = hoopLayout(side);
      c.drawImage(hoopImg, L.dx, L.dy, L.dw, L.dh);
    });
  }

  /** Lapisan DEPAN ring (Log 55): hanya potongan dari bibir ring ke
   *  bawah (jaring depan + bibir depan) digambar ULANG di atas bola —
   *  bola yang masuk terlihat tenggelam ke dalam jaring, persis ring
   *  sungguhan. Sesudah skor, jaring bergoyang sebentar. */
  function drawHoopsFront(c: CanvasRenderingContext2D, now: number): void {
    if (!hoopImg.complete || hoopImg.naturalWidth === 0) return;
    ([0, 1] as SideIdx[]).forEach((side) => {
      const L = hoopLayout(side);
      let sway = 0;
      for (const fx of hoopFx) {
        if (fx.outcome === "score" && Math.abs(fx.x - L.cx) < 4 && Math.abs(fx.y - L.cy) < 4) {
          const age = now - fx.t0;
          if (age < fx.dur) sway = Math.sin(age / 55) * 4 * (1 - age / fx.dur);
        }
      }
      // Bola di dalam jaring MENARIK jaringnya ke bawah (Log 56): potongan
      // jaring di bawah bola digambar bergeser turun mengikuti kedalaman
      // bola, jadi jaring terlihat menekuk & memanjang saat bola lewat —
      // bukan gambar diam yang ditembus bola.
      const rig = rigs[side];
      let stretch = 0;
      let cutY = Number.POSITIVE_INFINITY;
      if (rig.mode === "thrown" && rig.scored && rig.ball.y > L.cy && rig.ball.y < L.cy + L.depth) {
        const p = clamp((rig.ball.y - L.cy) / L.depth, 0, 1);
        stretch = p * BALL_R * 0.9;
        cutY = clamp(rig.ball.y - BALL_R * 0.3, L.cy + 8, L.cy + L.depth);
      }
      const top = L.cy - 6;
      const bottom = L.dy + L.dh;
      c.save();
      c.beginPath();
      c.rect(L.dx - 6, top, L.dw + 12, Math.min(cutY, bottom) - top);
      c.clip();
      c.drawImage(hoopImg, L.dx + sway, L.dy, L.dw, L.dh);
      c.restore();
      if (stretch > 0.5) {
        c.save();
        c.beginPath();
        c.rect(L.dx - 6, cutY, L.dw + 12, bottom - cutY + stretch);
        c.clip();
        c.drawImage(hoopImg, L.dx + sway, L.dy + stretch, L.dw, L.dh);
        c.restore();
      }
    });
  }

  function drawGlowUnderHoops(c: CanvasRenderingContext2D, now: number): void {
    // Cahaya lembut di bawah ring tiap tim (bernafas) — ring kiri biru
    // langit, ring kanan amber, mengikuti warna kedua tim.
    for (let i = 0; i < 2; i++) {
      const p = rimOf(i as SideIdx);
      const pulse = 0.5 + 0.5 * Math.sin(now / 420 + i * 1.3);
      const g = c.createRadialGradient(p.x, p.y + 54, 2, p.x, p.y + 54, 110);
      const speed = mood === "tense" ? 1.6 : 1;
      const rgb = i === 0 ? "56,189,248" : "245,158,11";
      g.addColorStop(0, `rgba(${rgb},${0.16 + 0.1 * pulse * speed})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.fillRect(p.x - 110, p.y - 56, 220, 220);
    }
  }

  /** Sorot ring SENDIRI yang sedang dibidik: elips berdenyut mengelilingi
   *  bibir ring supaya siswa tidak salah sasaran (Log 49). */
  function drawAimRings(c: CanvasRenderingContext2D, now: number): void {
    for (let i = 0; i < 2; i++) {
      if (rigs[i].mode !== "aim") continue;
      const p = rimOf(i as SideIdx);
      const pulse = 0.5 + 0.5 * Math.sin(now / 200);
      c.save();
      c.strokeStyle = `rgba(${SIDE_RGB[i]},${0.6 + 0.4 * pulse})`;
      c.lineWidth = 4 + 2 * pulse;
      c.beginPath();
      c.ellipse(p.x, p.y, p.half + 12 + 4 * pulse, 17 + 4 * pulse, 0, 0, TAU);
      c.stroke();
      c.restore();
    }
  }

  function frame(now: number): void {
    if (disposed) return;
    const dt = Math.min(0.033, (now - (lastFrame || now - 16)) / 1000);
    lastFrame = now;

    update(now, dt);

    ctx.clearRect(0, 0, w, h);
    if (court) ctx.drawImage(court, 0, 0, w, h);
    drawClouds(ctx, dt);
    drawGlowUnderHoops(ctx, now);
    drawHoopsBack(ctx);
    drawHoopFx(ctx, now);
    drawAimRings(ctx, now);
    rigs.forEach((rig, i) => {
      drawBallShadow(ctx, rig);
      drawMascot(ctx, rig, i as SideIdx, now);
    });
    rigs.forEach((rig, i) => drawAimPreview(ctx, rig, i as SideIdx));
    rigs.forEach((rig, i) => drawAimHint(ctx, rig, i as SideIdx, now));
    rigs.forEach((rig) => drawTrail(ctx, rig, now));
    rigs.forEach((rig) => drawBall(ctx, rig));
    drawHoopsFront(ctx, now);
    drawParticles(ctx);

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  return {
    resize,
    setMood(next) {
      mood = next;
    },
    setMascots(left, right) {
      const ids: [MascotId, MascotId] = [left, right];
      rigs.forEach((rig, i) => {
        if (rig.id !== ids[i]) {
          const fresh = makeRig(ids[i]);
          fresh.mode = rig.mode;
          fresh.pose = rig.pose;
          fresh.ball = rig.ball;
          fresh.y = rig.y;
          rigs[i] = fresh;
        }
      });
    },
    setImpactHandler(cb) {
      impactCb = cb;
    },
    beginAim,
    autoThrow,
    throwRemote,
    react,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      particles.length = 0;
      hoopFx.length = 0;
      rigs.forEach((rig) => {
        rig.trail.length = 0;
      });
    },
  };
}
