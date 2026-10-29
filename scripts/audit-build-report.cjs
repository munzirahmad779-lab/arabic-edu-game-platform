/**
 * Menyusun SPESIFIKASI.md dari hasil audit (audit.json per game).
 * Jalankan setelah papaninteraktif-audit.cjs (dan opsional probe animasi):
 *   node scripts/audit-build-report.cjs
 */
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(process.cwd(), "docs", "papaninteraktif-audit");

const readJSON = (p, fb) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fb;
  }
};

const hostOf = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
};

const FEATURES = {
  duel: /duel|1v1|1 vs 1|berdua|two player|2 pemain/i,
  room_multiplayer: /ramean|room|kamar|kode room|lobi|join/i,
  timer: /menit|detik|durasi|timer|waktu habis|countdown/i,
  difficulty: /mudah|sedang|sulit|level|tingkat kesulitan/i,
  sound_toggle: /suara|audio|musik|sound/i,
  fullscreen: /layar penuh|fullscreen|full screen/i,
  scoreboard: /papan skor|skor|score|peringkat/i,
  upload_photo: /upload|unggah|foto kamu|fotomu/i,
  camera: /kamera|camera|webcam/i,
  voice_mic: /mikrofon|mic\b|rekam suara|voice/i,
  ai_powered: /\bai\b|gemini|robot|kecerdasan buatan/i,
  three_d: /\b3d\b|three\.?js|ruang 3d/i,
  arabic_content: /hijaiyah|tajwid|qur|arab|mufradat|kosa kata arab/i,
  drag_drop: /seret|drag|geser|tarik/i,
  story_mode: /cerita|kisah|narasi|dongeng/i,
};

function detectFeatures(text) {
  const out = {};
  for (const [k, re] of Object.entries(FEATURES)) if (re.test(text)) out[k] = true;
  return out;
}

function main() {
  const dirs = fs
    .readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => fs.existsSync(path.join(OUT, n, "audit.json")));

  const games = [];

  for (const slug of dirs) {
    const audit = readJSON(path.join(OUT, slug, "audit.json"), null);
    if (!audit) continue;
    const steps = audit.steps || [];
    const landing = steps[0] || {};
    const landingHost = hostOf(landing.url);

    const gameSteps = steps.filter((s) => hostOf(s.url) && hostOf(s.url) !== landingHost);
    const gameHost = gameSteps.length ? hostOf(gameSteps[0].url) : "";
    const last = steps[steps.length - 1] || {};

    const allButtons = [...new Set(steps.flatMap((s) => s.buttons || []))];
    const allInputs = [...new Set(steps.flatMap((s) => (s.inputs || []).map((i) => `${i.type || "?"}:${i.name || i.placeholder || ""}`)))];
    const gameHeadings = [...new Set(gameSteps.flatMap((s) => s.headings || []))];
    const text = steps.map((s) => s.textSample || "").join(" \n ");
    const canvasMax = Math.max(0, ...steps.map((s) => s.canvasCount || 0));

    const sections = landing.hasSections || {};
    const missingSections = Object.entries({
      "TARGET AUDIENS": sections.target_audiens,
      "KONTEKS EDUKASI": sections.konteks_edukasi,
      "FOKUS BELAJAR": sections.fokus_belajar,
      "CARA BERMAIN": sections.cara_bermain,
      "MANFAAT PEMBELAJARAN": sections.manfaat,
      "MAIN SEKARANG": sections.main_sekarang,
    })
      .filter(([, v]) => !v)
      .map(([k]) => k);

    games.push({
      slug,
      landingUrl: landing.url || audit.url,
      landingH1: (landing.headings || []).find((h) => h.startsWith("H1:")) || "",
      landingH2: (landing.headings || []).filter((h) => h.startsWith("H2:")),
      gameHost,
      gameHeadings,
      pages: steps.length,
      canvas: canvasMax,
      buttons: allButtons.slice(0, 20),
      inputs: allInputs,
      missingSections,
      features: detectFeatures(text),
      screenshots: steps.map((s) => `${slug}/${s.screenshot}`),
    });
  }

  games.sort((a, b) => a.slug.localeCompare(b.slug));

  const md = [];
  md.push("# Spesifikasi & Audit Fitur — papaninteraktif.com");
  md.push("");
  md.push(`Diambil: ${new Date().toISOString()} · ${games.length} halaman game`);
  md.push("");
  md.push("## Ringkasan");
  md.push("");
  md.push("| # | Slug | Host aplikasi game | Halaman terekam | Canvas | Fitur terdeteksi |");
  md.push("|---|------|--------------------|-----------------|--------|------------------|");
  games.forEach((g, i) => {
    const f = Object.keys(g.features).join(", ") || "-";
    md.push(
      `| ${i + 1} | ${g.slug} | ${g.gameHost || "-"} | ${g.pages} | ${g.canvas ? "ya" : "tidak"} | ${f} |`,
    );
  });

  md.push("");
  md.push("## Detail per game");
  for (const g of games) {
    md.push("");
    md.push(`### ${g.slug}`);
    md.push("");
    md.push(`- Landing: ${g.landingUrl}`);
    if (g.gameHost) md.push(`- Aplikasi game: https://${g.gameHost}/`);
    md.push(`- Halaman terekam: ${g.pages}`);
    md.push(`- Canvas HTML5: ${g.canvas ? "ADA" : "tidak"}`);
    if (g.landingH2.length) md.push(`- Struktur landing: ${g.landingH2.join(" · ")}`);
    if (g.missingSections.length) md.push(`- Bagian wajib belum ada: ${g.missingSections.join(", ")}`);
    if (g.buttons.length) md.push(`- Tombol/kontrol: ${g.buttons.join(" · ")}`);
    if (g.inputs.length) md.push(`- Input: ${g.inputs.join(" · ")}`);
    if (g.gameHeadings.length) md.push(`- Heading di aplikasi: ${g.gameHeadings.slice(0, 6).join(" · ")}`);
    md.push(`- Fitur: ${Object.keys(g.features).join(", ") || "-"}`);
    md.push(`- Screenshot: ${g.screenshots.map((s) => "`" + s + "`").join(", ")}`);
  }

  md.push("");
  md.push("## Metode & keterbatasan");
  md.push("");
  md.push("- Setiap halaman `/game/<slug>` dibuka, lalu tombol **Main Sekarang** diikuti ke subdomain aplikasi game.");
  md.push("- Di dalam aplikasi, tombol mode/level/durasi diklik otomatis sampai 10 langkah; tiap langkah disimpan sebagai PNG + data DOM (heading, tombol, input, jumlah canvas).");
  md.push("- Fitur dideteksi dari teks DOM dan label tombol, bukan dari membaca gambar.");
  md.push("- Alur yang butuh login, kode room dari pemain lain, atau kamera/mikrofon tidak dapat ditembus otomatis.");

  fs.writeFileSync(path.join(OUT, "SPESIFIKASI.md"), md.join("\n"), "utf8");
  fs.writeFileSync(path.join(OUT, "games-index.json"), JSON.stringify(games, null, 2), "utf8");
  console.log(`SPESIFIKASI.md ditulis: ${games.length} game`);
}

main();
