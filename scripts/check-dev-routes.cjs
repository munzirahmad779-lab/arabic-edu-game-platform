const BASE = process.argv[2] || "http://127.0.0.1:3000";

const SLUGS = [
  "porogapit-arena", "math-domino-arena", "jejak-angka", "helirescue", "sciencelink",
  "banua-fruit-blast", "si-pemanah", "rimba-pedia", "celestial-weaver", "tanzib",
  "puzzle", "martabak-pecahan", "doodle", "si-taktik", "traditional", "space-war",
  "ai-basketball", "mancing-kata", "kancil", "nusaboard", "jagoan-kata", "geo-squad",
  "ruang-io", "gabung-ceria", "color-link-junior", "adu-tarik-dino", "tatap-hap",
  "cocok-logi", "mesin-koleksi", "pendekar-balon", "detektif-cilik", "mewarnai",
];

(async () => {
  console.log(`Dev check against ${BASE}\n`);

  for (const p of ["/", "/login", "/dashboard"]) {
    try {
      const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
      console.log(`  base ${p.padEnd(12)} -> ${res.status} ${res.headers.get("location") ?? ""}`);
    } catch (e) {
      console.log(`  base ${p.padEnd(12)} -> ERR ${e.message}`);
    }
  }
  console.log("");

  let ok = 0;
  const bad = [];
  for (const slug of SLUGS) {
    try {
      const res = await fetch(`${BASE}/games/${slug}`, { redirect: "manual" });
      const body = await res.status === 200 ? await res.text() : "";
      const rendered = body.includes("engine registry terverifikasi");
      if (res.status === 200 && rendered) {
        ok += 1;
        console.log(`  ${String(ok).padStart(2, "0")}. 200 OK  ${slug}`);
      } else {
        bad.push({ slug, status: res.status, rendered });
        console.log(`  FAIL ${res.status} (rendered=${rendered})  ${slug}`);
      }
    } catch (e) {
      bad.push({ slug, status: e.message });
      console.log(`  ERR  ${slug}: ${e.message}`);
    }
  }

  try {
    const res = await fetch(`${BASE}/games/tidak-ada-game-ini`, { redirect: "manual" });
    console.log(`\n  unknown slug -> ${res.status} (expect 404)`);
    if (res.status !== 404) bad.push({ slug: "<unknown>", status: res.status });
  } catch (e) {
    console.log(`\n  unknown slug -> ERR ${e.message}`);
  }

  console.log(`\nResult: ${ok}/32 game routes OK`);
  console.log(bad.length === 0 && ok === 32 ? "DEV CHECK PASSED" : `DEV CHECK FAILED ${JSON.stringify(bad)}`);
  process.exit(bad.length === 0 && ok === 32 ? 0 : 1);
})();
