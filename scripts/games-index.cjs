/**
 * Membuat docs/games/README.md (indeks 34 game) dari registry.json.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "games", "registry.json"), "utf8"));

const unik = registry.filter((g) => g.status !== "duplikat");
const dupes = registry.filter((g) => g.status === "duplikat");
const done = unik.filter((g) => g.status === "selesai").length;
const todo = unik.filter((g) => g.status === "belum").length;
const ext = unik.filter((g) => g.externalHost).map((g) => g.slug);

const rows = unik
  .map((g) => {
    const status = g.status === "selesai" ? "✅ selesai" : "⬜ belum";
    const tech = [g.canvases ? "canvas" : "dom", g.externalHost ? `ref: ${g.externalHost}` : ""].filter(Boolean).join(" · ");
    const fokus = (g.fokus || "-").replace(/\|/g, "/").slice(0, 90);
    return `| ${String(g.no).padStart(2, "0")} | \`${g.slug}\` | ${g.name} | ${fokus} | ${tech} | ${status} |`;
  })
  .join("\n");

const md = `# DAFTAR 34 GAME — indeks & status

Sumber referensi: papaninteraktif.com (folder audit: \`docs/papaninteraktif-audit/game-<slug>/\`).
Kontrak pengerjaan: [\`RULES.md\`](RULES.md) · Prompt per game: [\`PROMPT.md\`](PROMPT.md) · Data mentah: [\`registry.json\`](registry.json)

**Progres: ${done} selesai · ${todo} belum** (total ${unik.length} game unik).

> Game internal tambahan yang sudah selesai tapi tidak termasuk daftar referensi: \`souq-fishing\` (\`src/modules/souq-fishing\`).
>
> Halaman referensi yang **duplikat** (tidak dihitung sebagai game): ${dupes.map((d) => `\`${d.slug}\` → sama dengan \`${d.duplicateOf}\``).join(", ") || "-"}.

## Tabel

| # | Slug | Nama | Fokus belajar | Teknologi | Status |
|---|---|---|---|---|---|
${rows}

## Cara memakai

1. Pilih game (boleh urut, boleh lompat).
2. Cetak prompt:
   \`\`\`powershell
   node scripts/game-prompt.cjs 3
   node scripts/game-prompt.cjs cocok-logi
   \`\`\`
3. Buka sesi baru, tempel isi \`docs/games/prompts/GAME-<nn>-<slug>.md\`.
4. Sesudah game selesai, ubah \`status\` di \`registry.json\` menjadi \`"selesai"\` lalu jalankan:
   \`\`\`powershell
   node scripts/games-index.cjs
   \`\`\`

## Urutan yang disarankan

Kerjakan dari mekanik termudah → tersulit supaya pola kode makin matang:

1. **Kuis pilihan ganda / lempar jawaban**: \`ai-basketball\` (02), \`si-pemanah\` (29), \`pendekar-balon\` (23), \`martabak-pecahan\` (18)
2. **Cocokkan / pasangkan**: \`cocok-logi\` (06), \`color-link-junior\` (07), \`math-domino-arena\` (19), \`nusaboard\` (22)
3. **Susun kata / jigsaw**: \`jagoan-kata\` (14), \`mancing-kata\` (17), \`puzzle\` (25), \`gabung-ceria\` (11)
4. **Arena canvas + fisika**: \`banua-fruit-blast\` (03), \`space-war\` (31), \`helirescue\` (13), \`si-taktik\` (30)
5. **Eksplorasi / peta / papan**: \`geo-squad\` (12), \`rimba-pedia\` (26), \`ruang-io\` (27), \`sciencelink\` (28), \`mesin-koleksi\` (20), \`kancil\` (16)
6. **Kreatif & sensor**: \`mewarnai\` (21), \`doodle\` (09), \`traditional\` (34), \`tatap-hap\` (33), \`tanzib\` (32), \`celestial-weaver\` (05), \`detektif-cilik\` (08), \`jejak-angka\` (15)

## Game yang butuh kamera (baca dulu)

${ext.map((s) => `- \`${s}\` — referensi berjalan di domain terpisah; wajib punya fallback keyboard/mouse bila kamera ditolak.`).join("\n")}

## Aturan singkat yang paling sering dilupakan

- Tailwind \`content\` wajib mencakup \`./components/**\` (kalau tidak, semua warna panel hilang).
- Panel default **bawah**; tombol ganti layout hanya muncul di layar ≥ 1024 px.
- Kotak soal panjang: \`max-h\` + \`overflow-y-auto\` di pembungkus luar, \`min-h\` + \`flex flex-col justify-center\` di dalam — jangan flex-center + overflow pada elemen yang sama (bikin scroll ke atas rusak).
- Produksi selalu lewat \`npm run build:prod\` / \`npm run start:prod\` (folder \`.next-prod\`), supaya tidak bentrok dengan dev.
- Selesai = angka dilaporkan (tsc 0, build 0, matriks viewport PASS, fitur PASS), bukan klaim.
`;

fs.writeFileSync(path.join(ROOT, "docs", "games", "README.md"), md, "utf8");
console.log(`README.md dibuat: ${done} selesai / ${todo} belum / ${unik.length} unik`);
