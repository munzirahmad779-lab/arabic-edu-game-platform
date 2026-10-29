/** Perbaikan kecil pada render.ts: skala karakter belakang. */
const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "render.ts");
let s = fs.readFileSync(p, "utf8");
const before = s;

s = s.replace(
  "const placed: Record<Side, { id: string; x: number; y: number; lean: number; hand: ReturnType<typeof handPoint> }[]> = {",
  "const placed: Record<\n      Side,\n      { id: string; x: number; y: number; lean: number; scale: number; hand: ReturnType<typeof handPoint> }[]\n    > = {",
);
s = s.replace("placed[side].push({ id, x: feet.x, y: fy, lean, hand });", "placed[side].push({ id, x: feet.x, y: fy, lean, scale, hand });");
s = s.replace('drawChar(c.id, side, c.x, c.y, side === "p2" ? cell : cell, c.lean, squash);', "drawChar(c.id, side, c.x, c.y, c.scale, c.lean, squash);");

fs.writeFileSync(p, s, "utf8");
console.log("patched:", before !== s, "bytes:", s.length);
