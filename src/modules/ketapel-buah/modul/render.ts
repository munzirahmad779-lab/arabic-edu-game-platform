/**
 * Ketapel Buah — penggambar canvas.
 *
 * Adegan siang terang yang sama dengan Pappappe'. Tiap lajur mempunyai
 * satu pohon besar: batang + tajuk hijau, dan 7 buah foto Sulawesi
 * menggantung pada titik-titik tajuk (4 jawaban + 3 penyamar). Di bawah
 * pohon berdiri ketapel kayu gaya Angry Birds (aset + karet dinamis
 * yang sama dengan Pappappe') dan maskot lajur.
 */

import { hasArabic } from "../lib-pendamping/game-catalog";
import {
  SLING_TIP_L,
  SLING_TIP_MID,
  SLING_TIP_R,
  buildBackground,
  drawParticles,
  drawPopups,
  questionFontPx,
  wrapTextLines,
  HUD_H,
  type Particle,
  type Popup,
} from "@/modules/ketapel-shared/modul/render-helpers";
import { RULES, type FruitTarget, type LaneState, type SpriteId } from "./logic";
import { SLING_PHOTO, SPRITES, frameCrop, fruitAspect, fruitImage } from "./sprites";

export { buildBackground, drawParticles, drawPopups, HUD_H };
export type { Particle, Popup };

export interface LaneLayout {
  x: number;
  w: number;
  headerBottom: number;
  slots: { x: number; y: number }[];
  fruitR: number;
  anchor: { x: number; y: number };
  groundY: number;
}

const SLOT_FX = [0.2, 0.5, 0.8, 0.35, 0.65, 0.14, 0.86];
const SLOT_FY = [0.2, 0.16, 0.2, 0.34, 0.34, 0.44, 0.44];

export function layoutFor(w: number, h: number, count: number): LaneLayout[] {
  const laneW = w / count;
  const headerBottom = HUD_H;
  const arena = h - headerBottom;
  const groundY = h - 10;
  const anchorY = h - Math.max(150, Math.min(178, arena * 0.26));
  const fruitR = Math.max(20, Math.min(32, laneW * 0.052));
  const out: LaneLayout[] = [];
  for (let i = 0; i < count; i++) {
    const x = i * laneW;
    out.push({
      x,
      w: laneW,
      headerBottom,
      slots: SLOT_FX.map((fx, j) => ({ x: x + laneW * fx, y: headerBottom + arena * (SLOT_FY[j] ?? 0.3) })),
      fruitR,
      anchor: { x: x + laneW / 2, y: anchorY },
      groundY,
    });
  }
  return out;
}

/** Ayunan buah pada tangkainya (dipakai gambar + uji tembak, harus sama). */
export function targetSway(idx: number, elapsed: number): number {
  return Math.sin(elapsed * 1.3 + idx * 2.1) * 2.5;
}

export interface StoneView { x: number; y: number; visible: boolean }
export interface DragView { active: boolean; pouch: { x: number; y: number } }

export interface LaneView {
  lane: LaneState;
  stone: StoneView;
  drag: DragView;
  trail: { x: number; y: number }[];
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function drawMascot(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  sprite: SpriteId,
  frame: number,
  cx: number,
  bottom: number,
  size: number,
): void {
  const def = SPRITES[sprite];
  const x = cx - size / 2;
  const y = bottom - size;
  if (img && img.complete && img.naturalWidth > 0) {
    const crop = frameCrop(sprite === "tarsius" && frame === 1 ? 0 : frame); // bingkai 1 tarsius pada lembarnya memang pose tergantung terbalik; maskot berdiri memakai bingkai 0
    g.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, x, y, size, size);
  } else {
    g.fillStyle = def.fallback;
    g.beginPath();
    g.arc(cx, y + size / 2, size / 2.4, 0, Math.PI * 2);
    g.fill();
  }
}

function drawTree(g: CanvasRenderingContext2D, layout: LaneLayout): void {
  const cx = layout.x + layout.w / 2;
  const topY = layout.headerBottom + (layout.groundY - layout.headerBottom) * 0.3;
  // batang meruncing
  g.fillStyle = "#92400E";
  g.beginPath();
  g.moveTo(cx - 17, layout.groundY);
  g.lineTo(cx - 6, topY);
  g.lineTo(cx + 6, topY);
  g.lineTo(cx + 17, layout.groundY);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(69,26,3,0.35)";
  g.fillRect(cx - 2, topY + 26, 3, layout.groundY - topY - 30);
  // cabang ke titik buah
  g.strokeStyle = "rgba(146,64,14,0.75)";
  g.lineWidth = 5;
  g.lineCap = "round";
  for (const s of layout.slots) {
    g.beginPath();
    g.moveTo(cx, topY + 8);
    g.lineTo(s.x, s.y - layout.fruitR - 8);
    g.stroke();
  }
  // tajuk: gumpalan daun di sekitar titik buah
  const blobs: [number, number, number, string][] = [
    [0.5, 0.27, 0.24, "#16A34A"], [0.27, 0.33, 0.19, "#22C55E"], [0.73, 0.33, 0.19, "#22C55E"],
    [0.5, 0.4, 0.2, "#15803D"], [0.16, 0.45, 0.14, "#22C55E"], [0.84, 0.45, 0.14, "#22C55E"],
    [0.38, 0.18, 0.15, "#4ADE80"], [0.62, 0.18, 0.15, "#4ADE80"],
  ];
  const arena = layout.groundY - layout.headerBottom;
  for (const [fx, fy, fr, color] of blobs) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(layout.x + layout.w * fx, layout.headerBottom + arena * fy, layout.w * fr, layout.w * fr * 0.62, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function drawFruitTarget(
  g: CanvasRenderingContext2D,
  layout: LaneLayout,
  target: FruitTarget,
  elapsed: number,
  dim: boolean,
): void {
  if (target.state === "gone") return;
  const slot = layout.slots[target.idx] ?? layout.anchor;
  const sway = targetSway(target.idx, elapsed);
  const cx = slot.x + sway;
  const cy = slot.y + target.fallY;
  const r = layout.fruitR;
  const alpha = target.state === "fall" ? Math.max(0, 1 - target.fallY / 320) : 1;
  g.globalAlpha = alpha;
  // tangkai
  if (target.state === "hang") {
    g.strokeStyle = "rgba(101,53,15,0.8)";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx, cy - r - 13);
    g.lineTo(cx, cy - r + 2);
    g.stroke();
  }
  // buah foto
  const img = fruitImage(target.fruitId);
  if (img) {
    const drawH = r * 2 * 1.12;
    const drawW = drawH * fruitAspect(target.fruitId);
    g.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  } else {
    g.fillStyle = "#F59E0B";
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // papan jawaban di bawah buah (ikut jatuh)
  {
    const text = target.text;
    const arabic = hasArabic(text);
    const fontPx = r >= 28 ? 13 : 11.5;
    const font = `${arabic ? "" : "700 "}${fontPx}px ${arabic ? "'Amiri', serif" : "system-ui, sans-serif"}`;
    const pillMaxW = layout.w * 0.3;
    const pillW = Math.min(r * 2 + 52, pillMaxW, 230);
    const lines = wrapTextLines(text, font, pillW - 16, 2);
    const lineH = fontPx + 4;
    const pillH = lines.length * lineH + 10;
    const pillY = cy + r + 6;
    g.fillStyle = dim ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.97)";
    roundRect(g, cx - pillW / 2, pillY, pillW, pillH, 9);
    g.fill();
    g.strokeStyle = "rgba(30,27,75,0.18)";
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = "#1E1B4B";
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    lines.forEach((ln, i) => {
      g.fillText(ln, cx, pillY + 5 + lineH * (i + 0.5));
    });
  }
}

function drawHud(
  g: CanvasRenderingContext2D,
  layout: LaneLayout,
  lane: LaneState,
  img: HTMLImageElement | null,
): void {
  const pad = 8;
  const x = layout.x + pad;
  const w = layout.w - pad * 2;
  const h = HUD_H - 12;
  g.fillStyle = "rgba(255,255,255,0.94)";
  roundRect(g, x, 6, w, h, 14);
  g.fill();
  g.strokeStyle = lane.def.color;
  g.lineWidth = 2;
  g.stroke();
  drawMascot(g, img, lane.def.sprite, 0, x + 24, 6 + 40, 40);
  g.fillStyle = "#1E1B4B";
  g.font = "800 13px system-ui, sans-serif";
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText(lane.def.name.toUpperCase(), x + 48, 26);
  const scoreText = `${lane.score}`;
  g.font = "900 15px system-ui, sans-serif";
  const chipW = Math.max(44, g.measureText(scoreText).width + 20);
  g.fillStyle = lane.def.color;
  roundRect(g, x + w - chipW - 8, 12, chipW, 26, 13);
  g.fill();
  g.fillStyle = "#FFFFFF";
  g.textAlign = "center";
  g.fillText(scoreText, x + w - chipW / 2 - 8, 26);
  if (lane.q) {
    const fontPx = questionFontPx(layout.w);
    const arabic = lane.q.isArabic || hasArabic(lane.q.prompt);
    const font = `${arabic ? "" : "600 "}${fontPx}px ${arabic ? "'Amiri', serif" : "system-ui, sans-serif"}`;
    const lines = wrapTextLines(lane.q.prompt, font, w - 20, 3);
    const lineH = fontPx + 5;
    g.font = font;
    g.fillStyle = "#1E1B4B";
    lines.forEach((ln, i) => {
      const yy = 52 + lineH * (i + 0.5);
      if (arabic) {
        g.textAlign = "right";
        g.fillText(ln, x + w - 10, yy);
      } else {
        g.textAlign = "left";
        g.fillText(ln, x + 10, yy);
      }
    });
  }
}

/** Ketapel gaya Angry Birds: rangka foto + karet belakang (depan digambar sesudah batu). */
function drawKetapelFrame(
  g: CanvasRenderingContext2D,
  layout: LaneLayout,
  pouch: { x: number; y: number },
): { tipL: { x: number; y: number }; tipR: { x: number; y: number }; foto: boolean } {
  const ax = layout.anchor.x;
  const restY = layout.anchor.y;
  const slingImg = SLING_PHOTO.img;
  let tipL = { x: ax - 17, y: restY - 2 };
  let tipR = { x: ax + 17, y: restY - 2 };
  let foto = false;
  if (slingImg && slingImg.complete && slingImg.naturalWidth > 0) {
    foto = true;
    const tipTopY = restY - 20;
    let imgH = (layout.groundY + 2 - tipTopY) / (1 - SLING_TIP_MID.y);
    let imgW = imgH * (slingImg.naturalWidth / slingImg.naturalHeight);
    const maxW = layout.w * 0.52;
    if (imgW > maxW) {
      imgW = maxW;
      imgH = imgW * (slingImg.naturalHeight / slingImg.naturalWidth);
    }
    const dx = ax - SLING_TIP_MID.x * imgW;
    const dy = tipTopY - SLING_TIP_MID.y * imgH;
    g.fillStyle = "rgba(21,101,52,0.25)";
    g.beginPath();
    g.ellipse(ax, layout.groundY + 3, imgW * 0.3, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.drawImage(slingImg, dx, dy, imgW, imgH);
    tipL = { x: dx + SLING_TIP_L.x * imgW, y: dy + (SLING_TIP_L.y + 0.055) * imgH };
    tipR = { x: dx + SLING_TIP_R.x * imgW, y: dy + (SLING_TIP_R.y + 0.055) * imgH };
    // lilitan karet pada kedua ujung garpu
    g.fillStyle = "#7F1D1D";
    for (const tp of [tipL, tipR]) {
      roundRect(g, tp.x - 8, tp.y - 9, 16, 8, 4);
      g.fill();
    }
  } else {
    g.strokeStyle = "#92400E";
    g.lineCap = "round";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(ax, layout.groundY);
    g.lineTo(ax, restY + 18);
    g.stroke();
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(ax, restY + 16);
    g.lineTo(ax - 17, restY - 2);
    g.moveTo(ax, restY + 16);
    g.lineTo(ax + 17, restY - 2);
    g.stroke();
  }
  g.strokeStyle = "#991B1B";
  g.lineCap = "round";
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(tipL.x, tipL.y);
  g.lineTo(pouch.x, pouch.y);
  g.stroke();
  if (!foto) {
    g.beginPath();
    g.moveTo(tipR.x, tipR.y);
    g.lineTo(pouch.x, pouch.y);
    g.stroke();
    g.fillStyle = "#78350F";
    roundRect(g, pouch.x - 11, pouch.y - 6, 22, 12, 6);
    g.fill();
  }
  return { tipL, tipR, foto };
}

function drawKetapelFront(
  g: CanvasRenderingContext2D,
  tipR: { x: number; y: number },
  pouch: { x: number; y: number },
): void {
  g.strokeStyle = "#DC2626";
  g.lineCap = "round";
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(tipR.x, tipR.y);
  g.lineTo(pouch.x, pouch.y + 2);
  g.stroke();
  g.fillStyle = "#78350F";
  roundRect(g, pouch.x - 17, pouch.y - 1, 34, 15, 7);
  g.fill();
  g.strokeStyle = "#451A03";
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(pouch.x - 11, pouch.y + 4);
  g.lineTo(pouch.x + 11, pouch.y + 4);
  g.stroke();
}

export function drawScene(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: HTMLCanvasElement | null,
  layouts: LaneLayout[],
  views: LaneView[],
  images: Map<SpriteId, HTMLImageElement | null>,
  elapsed: number,
): void {
  if (bg) g.drawImage(bg, 0, 0, w, h);
  else {
    g.fillStyle = "#BAE6FD";
    g.fillRect(0, 0, w, h);
  }
  g.strokeStyle = "rgba(30,27,75,0.14)";
  g.lineWidth = 2;
  g.setLineDash([8, 8]);
  for (let i = 1; i < layouts.length; i++) {
    g.beginPath();
    g.moveTo(layouts[i].x, 8);
    g.lineTo(layouts[i].x, h - 8);
    g.stroke();
  }
  g.setLineDash([]);

  views.forEach((view, i) => {
    const layout = layouts[i];
    if (!layout) return;
    const img = images.get(view.lane.def.sprite) ?? null;
    drawTree(g, layout);
    const dim = view.lane.phase === "cheer";
    view.lane.targets.forEach((tg) => drawFruitTarget(g, layout, tg, elapsed, dim));
    const mascotSize = Math.max(72, Math.min(148, layout.w * 0.36));
    const mascotFrame = view.lane.phase === "cheer" ? 0 : 1;
    drawMascot(g, img, view.lane.def.sprite, mascotFrame, layout.anchor.x - mascotSize * 1.02, layout.groundY + 2, mascotSize);
    const ax = layout.anchor.x;
    const restY = layout.anchor.y;
    const pouch = view.drag.active ? view.drag.pouch : { x: ax, y: restY };
    const sling = drawKetapelFrame(g, layout, pouch);
    if (view.drag.active) {
      const vx = (ax - pouch.x) * RULES.launchK;
      let vy = (restY - pouch.y) * RULES.launchK;
      let px = pouch.x;
      let py = pouch.y;
      const dt = 0.07;
      g.fillStyle = "rgba(30,27,75,0.5)";
      for (let s = 0; s < 13; s++) {
        px += vx * dt;
        py += vy * dt;
        vy += RULES.gravity * dt;
        g.globalAlpha = 0.55 - s * 0.035;
        g.beginPath();
        g.arc(px, py, 3.4, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    if (view.trail.length > 1) {
      view.trail.forEach((tp, ti) => {
        g.globalAlpha = (ti / view.trail.length) * 0.3;
        g.fillStyle = "#44403C";
        g.beginPath();
        g.arc(tp.x, tp.y, 3 + (ti / view.trail.length) * 4, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;
    }
    if (view.stone.visible) {
      const stoneGrad = g.createRadialGradient(view.stone.x - 4, view.stone.y - 4, 2, view.stone.x, view.stone.y, RULES.stoneR + 2);
      stoneGrad.addColorStop(0, "#E7E5E4");
      stoneGrad.addColorStop(1, "#57534E");
      g.fillStyle = stoneGrad;
      g.beginPath();
      g.arc(view.stone.x, view.stone.y, RULES.stoneR, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(28,25,23,0.5)";
      g.lineWidth = 1.5;
      g.stroke();
    }
    if (sling.foto) drawKetapelFront(g, sling.tipR, pouch);
  });

  views.forEach((view, i) => {
    const layout = layouts[i];
    if (!layout) return;
    drawHud(g, layout, view.lane, images.get(view.lane.def.sprite) ?? null);
  });
}
