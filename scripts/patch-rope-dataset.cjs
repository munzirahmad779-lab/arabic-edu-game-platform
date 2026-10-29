/** Ekspos koordinat tali ke DOM agar kesejajaran bisa diukur pasti (bukan dari warna). */
const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "render.ts");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  `    const sag = 16 + 34 * (1 - tension);`,
  `    const sag = 16 + 34 * (1 - tension);

    // diagnostik: posisi ujung tali (untuk uji kesejajaran)
    if (canvas.dataset) {
      canvas.dataset.rope = \`\${x0.toFixed(1)},\${x1.toFixed(1)},\${y0.toFixed(1)},\${y1.toFixed(1)}\`;
      canvas.dataset.width = String(Math.round(w));
      canvas.dataset.result = view.result.current ?? "";
      canvas.dataset.groundY = String(Math.round(groundY));
    }`,
  "dataset-rope",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
