/** Pasang Game-v2.tsx sebagai Game.tsx lalu hapus berkas sementara. */
const fs = require("fs");
const path = require("path");
const dir = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino");
const src = path.join(dir, "Game-v2.tsx");
const dst = path.join(dir, "Game.tsx");
if (!fs.existsSync(src)) {
  console.error("Game-v2.tsx tidak ada");
  process.exit(1);
}
fs.copyFileSync(src, dst);
fs.unlinkSync(src);
console.log("Game.tsx diperbarui, ukuran:", fs.statSync(dst).size);
