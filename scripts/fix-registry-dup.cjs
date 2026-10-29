/**
 * Perbaikan registry:
 * - `belajar-angka` ternyata halaman duplikat dari "Lab Warna" (= mewarnai),
 *   jadi tidak dihitung sebagai game terpisah.
 * - Nomor diambil dari 33 game unik: #1 adu-tarik-dino selesai, sisanya #2..#33.
 */
const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "extract-game-registry.cjs");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  `const DONE = {
  "adu-tarik-dino": { no: 1, status: "selesai", folder: "components/games/adu-tarik-dino" },
};`,
  `const DONE = {
  "adu-tarik-dino": { no: 1, status: "selesai", folder: "components/games/adu-tarik-dino" },
};

// halaman yang isinya duplikat game lain di situs referensi (bukan game terpisah)
const DUPLICATE = {
  "belajar-angka": { duplicateOf: "mewarnai", note: "halamannya menampilkan 'Lab Warna' — sama dengan mewarnai" },
};`,
  "dup-map",
);

sub(
  `  .map((g) => (g.no === 0 ? { ...g, no: nextNo++ } : g));`,
  `  .map((g) => {
    const dup = DUPLICATE[g.slug];
    if (dup) return { ...g, no: 0, status: "duplikat", ...dup };
    return g.no === 0 ? { ...g, no: nextNo++ } : g;
  });`,
  "dup-handling",
);

sub(
  `console.log(withNumbers.map((g) => \`\${String(g.no).padStart(2, "0")} \${g.slug.padEnd(24)} \${g.status.padEnd(8)} ext=\${g.externalHost || "-"}\`).join("\\n"));`,
  `const unik = withNumbers.filter((g) => g.status !== "duplikat");
console.log(\`game unik: \${unik.length} · selesai: \${unik.filter((g) => g.status === "selesai").length} · sisa: \${unik.filter((g) => g.status === "belum").length}\`);
console.log(
  withNumbers
    .map((g) => \`\${g.status === "duplikat" ? "--" : String(g.no).padStart(2, "0")} \${g.slug.padEnd(22)} \${g.status.padEnd(9)} ext=\${g.externalHost || "-"}\`)
    .join("\\n"),
);`,
  "print",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
