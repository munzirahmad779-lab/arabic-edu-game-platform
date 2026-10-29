/**
 * Menyusun registry 34 game referensi dari hasil audit (docs/papaninteraktif-audit).
 * Output: docs/games/registry.json
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const AUD = path.join(ROOT, "docs", "papaninteraktif-audit");
const OUT = path.join(ROOT, "docs", "games");

// 34 game referensi papaninteraktif.com. souq-fishing adalah game internal
// (tidak termasuk daftar referensi) dan sudah selesai — dicatat terpisah.
const DONE = {
  "adu-tarik-dino": { no: 1, status: "selesai", folder: "components/games/adu-tarik-dino" },
};

// halaman yang isinya duplikat game lain di situs referensi (bukan game terpisah)
const DUPLICATE = {
  "belajar-angka": { duplicateOf: "mewarnai", note: "halamannya menampilkan 'Lab Warna' — sama dengan mewarnai" },
};

const cut = (txt, from, to) => {
  const i = txt.indexOf(from);
  if (i < 0) return "";
  const rest = txt.slice(i + from.length);
  const j = to ? rest.indexOf(to) : -1;
  return (j < 0 ? rest : rest.slice(0, j)).trim().replace(/\s+/g, " ");
};

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

const dirs = fs
  .readdirSync(AUD, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith("game-"))
  .map((d) => d.name)
  .sort();

const games = dirs.map((dir) => {
  const slug = dir.replace(/^game-/, "");
  const audit = readJson(path.join(AUD, dir, "audit.json"));
  const flow = readJson(path.join(AUD, dir, "deep-flow.json"));

  const landing = audit?.steps?.[0] ?? {};
  const text = landing.textSample ?? "";
  const name = (landing.headings?.[0] ?? "").replace(/^H1:\s*/, "") || slug;

  const externalHost = (() => {
    const url = flow?.steps?.[0]?.url ?? "";
    try {
      const h = new URL(url).hostname;
      return h.includes("papaninteraktif.com") && !h.startsWith("game") ? "" : h;
    } catch {
      return "";
    }
  })();

  const playSteps = (flow?.steps ?? []).length;
  const canvases = (flow?.steps ?? []).reduce((n, s) => n + (s.canvases?.length ? 1 : 0), 0);
  const buttons = (flow?.steps ?? []).reduce((n, s) => n + (s.buttons?.length ?? 0), 0);

  return {
    dir,
    slug,
    name,
    fokus: cut(text, "FOKUS BELAJAR", "CARA BERMAIN"),
    cara: cut(text, "CARA BERMAIN", "MANFAAT PEMBELAJARAN"),
    konteks: cut(text, "KONTEKS EDUKASI", "FOKUS BELAJAR"),
    audiens: cut(text, "TARGET AUDIENS", "KONTEKS EDUKASI"),
    manfaat: cut(text, "MANFAAT PEMBELAJARAN", "Temukan lebih banyak"),
    externalHost,
    playSteps,
    canvases,
    buttons,
    hasDeepScreens: (flow?.steps ?? []).length > 0,
    deepText: ((flow?.steps ?? []).map((s) => s.text ?? "").join(" ") || "").slice(0, 1200),
  };
});

const noDone = new Set(Object.keys(DONE));
let nextNo = 2;
const withNumbers = games
  .map((g) => {
    const d = DONE[g.slug];
    return { ...g, no: d ? d.no : 0, status: d ? d.status : "belum" };
  })
  .sort((a, b) => {
    if (a.no && b.no) return a.no - b.no;
    if (a.no) return -1;
    if (b.no) return 1;
    return a.slug.localeCompare(b.slug);
  })
  .map((g) => {
    const dup = DUPLICATE[g.slug];
    if (dup) return { ...g, no: 0, status: "duplikat", ...dup };
    return g.no === 0 ? { ...g, no: nextNo++ } : g;
  });

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "registry.json"), JSON.stringify(withNumbers, null, 2), "utf8");

console.log(`total game: ${withNumbers.length}`);
const unik = withNumbers.filter((g) => g.status !== "duplikat");
console.log(`game unik: ${unik.length} · selesai: ${unik.filter((g) => g.status === "selesai").length} · sisa: ${unik.filter((g) => g.status === "belum").length}`);
console.log(
  withNumbers
    .map((g) => `${g.status === "duplikat" ? "--" : String(g.no).padStart(2, "0")} ${g.slug.padEnd(22)} ${g.status.padEnd(9)} ext=${g.externalHost || "-"}`)
    .join("\n"),
);
