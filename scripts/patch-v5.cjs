/**
 * render.ts v5:
 *  - ArenaView.result → tim kalah benar-benar terseret ke arah pemenang
 *  - garis tengah (center guide) untuk mengecek kesejajaran
 *  - pemain belakang ikut terseret, condong ke arah pemenang
 */
const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "render.ts");
let s = fs.readFileSync(file, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

// A. tipe result
sub(
  "  shake: { current: number };",
  '  shake: { current: number };\n  result: { current: "p1" | "p2" | "draw" | null };',
  "arena-view-result",
);

// B. state drag
sub(
  "  let dustTimer = 0;",
  "  let dustTimer = 0;\n  let resultStart = -1;\n  let dragP1 = 0;\n  let dragP2 = 0;\n  let dragE = 0;",
  "drag-state",
);

// C. feet ikut terseret
sub(
  '    return { x: base + shift + dir * index * cell * 0.54, y: h * 0.82 };',
  '    const drag = side === "p1" ? dragP1 : dragP2;\n    return { x: base + shift + dir * index * cell * 0.54 + drag, y: h * 0.82 };',
  "feet-drag",
);

// D. hitung drag per frame
sub(
  "    const shift = (shown / view.maxOffset) * (w * 0.18);",
  `    const shift = (shown / view.maxOffset) * (w * 0.18);

    const res = view.result.current;
    if (res && resultStart < 0) resultStart = now;
    if (!res) resultStart = -1;
    const dragP = res ? clamp((now - resultStart) / 1400, 0, 1) : 0;
    dragE = 1 - Math.pow(1 - dragP, 3);
    const dirSign = res === "p1" ? -1 : res === "p2" ? 1 : 0;
    dragP1 = dirSign === 0 ? 0 : dirSign < 0 ? -w * 0.04 * dragE : w * 0.26 * dragE;
    dragP2 = dirSign === 0 ? 0 : dirSign > 0 ? w * 0.04 * dragE : -w * 0.26 * dragE;`,
  "drag-loop",
);

// E. lean pemenang/kalah
sub(
  `        const lean = leanBase * dir * -0.12 + dir * -0.015;
        const scale = i === 0 ? cell : cell * 1.07;
        const bob = breathe * (i === 0 ? 1 : 0.8);
        const hand = handPoint(id, side, feet.x, feet.y, scale, lean, bob);
        placed[side].push({ id, x: feet.x, y: feet.y, lean, scale, bob, hand });`,
  `        const isLoser = res ? (res === "p1" ? side === "p2" : side === "p1") : false;
        const isWinner = res ? (res === "p1" ? side === "p1" : side === "p2") : false;
        const dragLean = (isLoser ? (res === "p1" ? -1 : 1) * 0.26 : 0) + (isWinner ? (res === "p1" ? 1 : -1) * 0.1 : 0);
        const lean = leanBase * dir * -0.12 + dir * -0.015 + dragLean * dragE;
        const scale = i === 0 ? cell : cell * 1.07;
        const bob = breathe * (i === 0 ? 1 : 0.8);
        const hand = handPoint(id, side, feet.x, feet.y, scale, lean, bob);
        placed[side].push({ id, x: feet.x, y: feet.y, lean, scale, bob, hand });`,
  "drag-lean",
);

// F. garis tengah (setelah loop zona batas)
sub(
  `    const leanBase = clamp(shown / view.maxOffset, -1, 1);`,
  `    // ---- garis tengah: acuan kesejajaran ----
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

    const leanBase = clamp(shown / view.maxOffset, -1, 1);`,
  "center-line",
);

fs.writeFileSync(file, s, "utf8");
console.log(log.join("\n"));
