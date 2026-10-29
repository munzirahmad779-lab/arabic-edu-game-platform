const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "next.config.mjs");
let s = fs.readFileSync(p, "utf8");
if (s.includes("NEXT_DIST_DIR")) {
  console.log("sudah ada distDir env");
  process.exit(0);
}
const anchor = "const nextConfig = {";
const insert = `const nextConfig = {
  // Pisahkan folder hasil build dev (.next) dan produksi (.next-prod) agar
  // "next dev" dan "next start" bisa jalan bersamaan tanpa saling menimpa.
  distDir: process.env.NEXT_DIST_DIR || ".next",`;
s = s.replace(anchor, insert);
fs.writeFileSync(p, s, "utf8");
console.log("distDir env ditambahkan:", s.includes("NEXT_DIST_DIR"));
