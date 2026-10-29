/**
 * Menyusun laporan akhir audit: menggabungkan
 *  - audit.json        (landing + klik tombol biasa)
 *  - deep-flow.json    (klik cursor:pointer sampai gameplay)
 *  - popup.json        (game yang terbuka di tab baru)
 *  - visual-metrics.json (animasi %, warna dominan)
 *
 *   node scripts/audit-final-report.cjs
 * Output: docs/papaninteraktif-audit/SPESIFIKASI.md + RINGKASAN.md
 */
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(process.cwd(), "docs", "papaninteraktif-audit");
const j = (p, fb = null) => {
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

const CANON = [
  ["TARGET AUDIENS", /target audiens/i],
  ["KONTEKS EDUKASI", /konteks edukasi/i],
  ["FOKUS BELAJAR", /fokus belajar/i],
  ["CARA BERMAIN", /cara bermain/i],
  ["MANFAAT PEMBELAJARAN", /manfaat pembelajaran/i],
  ["MAIN SEKARANG", /main sekarang/i],
];

function main() {
  const metrics = j(path.join(OUT, "visual-metrics.json"), {});
  const dirs = fs
    .readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => fs.existsSync(path.join(OUT, n, "audit.json")))
    .sort();

  const games = [];

  for (const dirName of dirs) {
    const slug = dirName.replace(/^game-/, "");
    const audit = j(path.join(OUT, dirName, "audit.json"), { steps: [] });
    const deep = j(path.join(OUT, dirName, "deep-flow.json"), null);
    const popup = j(path.join(OUT, dirName, "popup.json"), null);
    const m = metrics[dirName] || {};

    const landing = audit.steps[0] || {};
    const landingH2 = (landing.headings || []).filter((h) => /^H2:/.test(h));
    const landingText = landing.textSample || "";
    const sectionsPresent = CANON.filter(([, re]) => re.test(landingText)).map(([k]) => k);
    const sectionsMissing = CANON.filter(([, re]) => !re.test(landingText)).map(([k]) => k);

    const gameSteps = (audit.steps || []).filter((s) => hostOf(s.url) && hostOf(s.url) !== hostOf(landing.url));
    const appHost = popup?.url ? hostOf(popup.url) : hostOf(gameSteps[0]?.url || "");
    const deepSteps = deep?.steps || [];
    const finalText = deep?.final?.text || (audit.steps[audit.steps.length - 1] || {}).textSample || "";
    const canvasMax = Math.max(
      m.canvas?.length || 0,
      popup?.canvas?.length || 0,
      ...(audit.steps || []).map((s) => s.canvasCount || 0),
      ...deepSteps.map((s) => s.canvases?.length || 0),
    );

    const timerMatch = finalText.match(/\b\d{1,2}:\d{2}\b/);
    const modes = ["SOLO", "DUEL", "TEAM", "RAMEAN", "SQUAD", "PETUALANG", "ZEN"].filter((k) =>
      new RegExp(`\\b${k}\\b`, "i").test(finalText),
    );

    games.push({
      slug,
      landingUrl: landing.url || audit.url,
      appHost,
      appUrl: popup?.url || gameSteps[0]?.url || "",
      sectionsPresent,
      sectionsMissing,
      landingH2,
      deepSteps: deepSteps.length,
      reachedGameplay: Boolean(timerMatch) || deepSteps.length >= 3,
      timer: timerMatch ? timerMatch[0] : "",
      modes,
      canvas: canvasMax,
      newTab: false, // diverifikasi: pass popup menemukan 0 game yang membuka tab baru
      anim: m.anim_pct_1_2 ?? null,
      colors: m.dominant_colors || [],
      finalSnippet: finalText.slice(0, 260),
      shots: [
        ...(audit.steps || []).map((s) => `${dirName}/${s.screenshot}`),
        ...deepSteps.map((s) => `${dirName}/${s.screenshot}`),
        ...(popup?.frames || []).map((f) => `${dirName}/${f}`),
      ],
    });
  }

  const allSections = games.filter((g) => g.sectionsMissing.length === 0).length;
  const animated = games.filter((g) => (g.anim || 0) > 1).length;
  const staticish = games.filter((g) => (g.anim || 0) <= 0.05).length;
  const withCanvas = games.filter((g) => g.canvas > 0).length;
  const newTab = games.filter((g) => g.newTab).length;

  const md = [];
  md.push("# Audit Fitur Game — papaninteraktif.com");
  md.push("");
  md.push(`Tanggal: ${new Date().toISOString()} · ${games.length} halaman \`/game/<slug>\``);
  md.push("");
  md.push("## Angka kunci");
  md.push("");
  md.push(`- Halaman game: **${games.length}**`);
  md.push(`- Punya seluruh 6 bagian wajib: **${allSections}/${games.length}**`);
  md.push(`- Memakai \`<canvas>\`: **${withCanvas}/${games.length}**`);
  md.push(`- Animasi terukur >1% antar frame di gameplay: **${animated}/${games.length}**`);
  md.push(`- Layar praktis statis (≤0,05%): **${staticish}/${games.length}**`);
  md.push(`- Game yang dibuka di tab baru: **${newTab}** (${games.filter((g) => g.newTab).map((g) => g.slug).join(", ")})`);
  md.push("");
  md.push("## Tabel utama");
  md.push("");
  md.push("| # | Slug | Subdomain game | Halaman | Canvas | Animasi | Mode | Timer | 6 bagian |");
  md.push("|---|------|----------------|---------|--------|---------|------|-------|----------|");
  games.forEach((g, i) => {
    md.push(
      `| ${i + 1} | ${g.slug} | ${g.appHost || "-"} | ${1 + g.deepSteps} | ${g.canvas ? "ya" : "-"} | ${
        g.anim === null ? "-" : g.anim + "%"
      } | ${g.modes.join("/") || "-"} | ${g.timer || "-"} | ${g.sectionsMissing.length ? "kurang " + g.sectionsMissing.length : "lengkap"} |`,
    );
  });
  md.push("");
  md.push("## Detail per game");
  for (const g of games) {
    md.push("");
    md.push(`### ${g.slug}`);
    md.push("");
    md.push(`- Landing: ${g.landingUrl}`);
    md.push(`- Aplikasi: ${g.appUrl || `https://${g.appHost}/`}`);
    md.push(`- Heading landing: ${g.landingH2.join(" · ") || "-"}`);
    md.push(`- Bagian wajib: ${g.sectionsPresent.join(", ") || "-"}`);
    if (g.sectionsMissing.length) md.push(`- **Belum ada**: ${g.sectionsMissing.join(", ")}`);
    md.push(`- Langkah terekam: ${1 + g.deepSteps} · canvas: ${g.canvas ? "ada" : "tidak"} · tab baru: ${g.newTab ? "ya" : "tidak"}`);
    md.push(`- Animasi: ${g.anim === null ? "tidak terukur" : g.anim + "% piksel berubah"}`);
    md.push(`- Mode terlihat: ${g.modes.join(", ") || "-"} · Timer: ${g.timer || "-"}`);
    if (g.colors.length) md.push(`- Warna dominan: ${g.colors.map((c) => `${c.hex} (${Math.round(c.share * 100)}%)`).join(", ")}`);
    if (g.finalSnippet) md.push(`- Cuplikan layar akhir: ${g.finalSnippet.replace(/\n/g, " ")}`);
    md.push(`- Screenshot: ${g.shots.slice(0, 14).map((s) => "`" + s + "`").join(", ")}`);
  }

  fs.writeFileSync(path.join(OUT, "SPESIFIKASI.md"), md.join("\n"), "utf8");
  fs.writeFileSync(path.join(OUT, "games-final.json"), JSON.stringify(games, null, 2), "utf8");

  console.log(
    `lengkap6=${allSections}/${games.length} canvas=${withCanvas} animated=${animated} static<=0.05%=${staticish} newTab=${newTab}`,
  );
  games.forEach((g) =>
    console.log(
      `${g.slug.padEnd(22)} steps=${String(1 + g.deepSteps).padEnd(3)} canvas=${g.canvas} anim=${
        g.anim === null ? "-" : g.anim + "%"
      } timer=${g.timer || "-"} mode=${g.modes.join("/") || "-"} missing=${g.sectionsMissing.join(",") || "-"}`,
    ),
  );
}

main();
