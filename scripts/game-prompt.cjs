/**
 * Cetak & simpan prompt siap pakai untuk satu game.
 *   node scripts/game-prompt.cjs 3
 *   node scripts/game-prompt.cjs cocok-logi
 * Output: docs/games/prompts/GAME-<nn>-<slug>.md (+ stdout)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "games", "registry.json"), "utf8"));

const arg = (process.argv[2] || "").trim();
if (!arg) {
  console.log("Pakai: node scripts/game-prompt.cjs <nomor|slug>");
  console.log(registry.map((g) => `${String(g.no).padStart(2, "0")}  ${g.slug}  — ${g.name} [${g.status}]`).join("\n"));
  process.exit(0);
}

const game =
  registry.find((g) => String(g.no) === arg) ||
  registry.find((g) => g.slug === arg || g.slug.includes(arg));

if (!game) {
  console.error(`Game "${arg}" tidak ada di registry.`);
  process.exit(1);
}

const tpl = fs.readFileSync(path.join(ROOT, "docs", "games", "PROMPT.md"), "utf8");
const start = tpl.indexOf("````markdown");
const end = tpl.indexOf("````", start + 12);
if (start < 0 || end < 0) {
  console.error("Blok TEMPLATE tidak ditemukan di docs/games/PROMPT.md");
  process.exit(1);
}
let prompt = tpl.slice(start + "````markdown".length, end).trim();

const auditDir = path.join(ROOT, "docs", "papaninteraktif-audit", game.dir);
const hasAudit = fs.existsSync(auditDir);

const fill = {
  "{{NO}}": String(game.no).padStart(2, "0"),
  "{{SLUG}}": game.slug,
  "{{NAME}}": game.name,
  "{{FOKUS}}": game.fokus || "(lihat audit.json)",
  "{{CARA}}": game.cara || "(lihat audit.json)",
};

for (const [k, v] of Object.entries(fill)) prompt = prompt.split(k).join(v);

const notes = [];
if (!hasAudit) notes.push(`> Catatan: folder audit \`docs/papaninteraktif-audit/${game.dir}/\` tidak ada — andalkan deskripsi di registry.`);
if (game.externalHost) notes.push(`> Catatan: game referensi berjalan di \`${game.externalHost}\` (iframe). Bangun versi sendiri, jangan sematkan iframe.`);
if (game.canvases === 0) notes.push(`> Catatan: audit tidak menemukan elemen <canvas>; arena kemungkinan DOM/CSS — bebas memilih canvas atau SVG/DOM.`);

if (notes.length) prompt = notes.join("\n") + "\n\n" + prompt;

const outDir = path.join(ROOT, "docs", "games", "prompts");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `GAME-${fill["{{NO}}"]}-${game.slug}.md`);
fs.writeFileSync(outFile, prompt + "\n", "utf8");

console.log(prompt);
console.log("\n---");
console.log(`tersimpan: ${path.relative(ROOT, outFile)}`);
