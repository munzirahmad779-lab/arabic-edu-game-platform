const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "games-index.cjs");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  `const done = registry.filter((g) => g.status === "selesai").length;
const todo = registry.length - done;
const ext = registry.filter((g) => g.externalHost).map((g) => g.slug);

const rows = registry`,
  `const unik = registry.filter((g) => g.status !== "duplikat");
const dupes = registry.filter((g) => g.status === "duplikat");
const done = unik.filter((g) => g.status === "selesai").length;
const todo = unik.filter((g) => g.status === "belum").length;
const ext = unik.filter((g) => g.externalHost).map((g) => g.slug);

const rows = unik`,
  "unik-only",
);

sub(
  `**Progres: \${done} selesai · \${todo} belum** (total \${registry.length} game).`,
  `**Progres: \${done} selesai · \${todo} belum** (total \${unik.length} game unik).`,
  "counts",
);

sub(
  `> Game internal tambahan yang sudah selesai tapi tidak termasuk daftar referensi: \\\`souq-fishing\\\` (\\\`src/modules/souq-fishing\\\`).`,
  `> Game internal tambahan yang sudah selesai tapi tidak termasuk daftar referensi: \\\`souq-fishing\\\` (\\\`src/modules/souq-fishing\\\`).
>
> Halaman referensi yang **duplikat** (tidak dihitung sebagai game): \${dupes.map((d) => `\\\`\${d.slug}\\\` → sama dengan \\\`\${d.duplicateOf}\\\``).join(", ") || "-"}.`,
  "dup-note",
);

sub(
  "console.log(`README.md dibuat: ${done} selesai / ${todo} belum / ${registry.length} total`);",
  "console.log(`README.md dibuat: ${done} selesai / ${todo} belum / ${unik.length} unik`);",
  "log",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
