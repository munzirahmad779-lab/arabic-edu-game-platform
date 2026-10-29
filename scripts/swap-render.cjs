/** Tukar render.ts dengan render-v3.ts lalu hapus berkas sementara. */
const fs = require("fs");
const path = require("path");
const dir = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino");
const src = path.join(dir, "render-v3.ts");
const dst = path.join(dir, "render.ts");
if (!fs.existsSync(src)) {
  console.error("render-v3.ts tidak ada");
  process.exit(1);
}
fs.copyFileSync(src, dst);
fs.unlinkSync(src);
console.log("render.ts diganti, ukuran:", fs.statSync(dst).size);
