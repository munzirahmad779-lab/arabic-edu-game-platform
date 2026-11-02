/**
 * Ketapel bersama — pembantu gambar canvas: latar siang tersimpan,
 * pembungkus teks, konstanta ujung garpu ketapel, partikel dan popup.
 * Dipakai bersama oleh Ketapel Buah dan Ketapel Burung (Log 69).
 */

/** Ujung garpu ketapel pada aset foto (fraksi, terukur dari piksel alfa). */
export const SLING_TIP_L = { x: 0.2155, y: 0.0007 };
export const SLING_TIP_R = { x: 0.7837, y: 0.0033 };
export const SLING_TIP_MID = { x: 0.4996, y: 0.002 };

/** Tinggi kartu soal tetap (cadangan 3 baris) agar tata letak stabil. */
export const HUD_H = 108;

/* ------------------------------------------------------------ teks */

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx as CanvasRenderingContext2D;
}

export function questionFontPx(laneW: number): number {
  if (laneW >= 320) return 15;
  if (laneW >= 210) return 13;
  return 11.5;
}

export function wrapTextLines(text: string, font: string, maxW: number, maxLines: number): string[] {
  const ctx = measurer();
  ctx.font = font;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !cur) {
      cur = next;
    } else {
      lines.push(cur);
      cur = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    const joined = lines.join(" ");
    if (joined.length < text.length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

/* ------------------------------------------------------------ latar */

export function buildBackground(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.floor(w));
  c.height = Math.max(2, Math.floor(h));
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#7DD3FC");
  sky.addColorStop(0.55, "#E0F2FE");
  sky.addColorStop(1, "#FEF9C3");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // matahari
  const sun = g.createRadialGradient(w - 90, 64, 6, w - 90, 64, 64);
  sun.addColorStop(0, "rgba(253,224,71,0.95)");
  sun.addColorStop(1, "rgba(253,224,71,0)");
  g.fillStyle = sun;
  g.fillRect(w - 170, 0, 170, 150);
  // awan
  g.fillStyle = "rgba(255,255,255,0.85)";
  const clouds: [number, number, number][] = [[0.12, 0.1, 46], [0.45, 0.06, 34], [0.7, 0.13, 40], [0.3, 0.18, 26]];
  for (const [fx, fy, r] of clouds) {
    const cx = fx * w, cy = fy * h;
    g.beginPath();
    g.ellipse(cx, cy, r * 1.7, r * 0.55, 0, 0, Math.PI * 2);
    g.ellipse(cx - r * 0.8, cy + 4, r, r * 0.42, 0, 0, Math.PI * 2);
    g.ellipse(cx + r * 0.9, cy + 5, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
  }
  // bukit jauh + tanah
  g.fillStyle = "#86EFAC";
  g.beginPath();
  g.ellipse(w * 0.22, h + 30, w * 0.5, h * 0.24, 0, Math.PI, Math.PI * 2);
  g.ellipse(w * 0.85, h + 40, w * 0.45, h * 0.2, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = "#4ADE80";
  g.fillRect(0, h - 44, w, 44);
  g.fillStyle = "#22C55E";
  g.fillRect(0, h - 44, w, 5);
  return c;
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
export interface Popup { x: number; y: number; text: string; life: number; maxLife: number; color: string }

export function drawParticles(g: CanvasRenderingContext2D, parts: Particle[]): void {
  for (const p of parts) {
    const a = Math.max(0, p.life / p.maxLife);
    g.globalAlpha = a;
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, p.size * a + 0.6, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function drawPopups(g: CanvasRenderingContext2D, pops: Popup[]): void {
  for (const p of pops) {
    const a = Math.max(0, p.life / p.maxLife);
    g.globalAlpha = Math.min(1, a * 1.6);
    g.font = "900 24px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 5;
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.strokeText(p.text, p.x, p.y);
    g.fillStyle = p.color;
    g.fillText(p.text, p.x, p.y);
  }
  g.globalAlpha = 1;
}
