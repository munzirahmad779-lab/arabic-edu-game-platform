#!/usr/bin/env node

/** Reconnect the standalone games pack created by game-pack-detach.js. */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const packDir = path.join(repoRoot, "src", "modules", "games-pack");
const standaloneDir = path.resolve(
  process.env.MAGGURU_GAMES_PACK_DIR || path.join(repoRoot, "..", "game"),
);

if (!fs.existsSync(standaloneDir)) {
  console.error(`Standalone games pack tidak ditemukan di ${standaloneDir}`);
  process.exit(1);
}

const standaloneRegistry = path.join(standaloneDir, "games-registry.ts");
if (!fs.existsSync(standaloneRegistry) || /GAME_PACK_AVAILABLE\s*=\s*false/.test(fs.readFileSync(standaloneRegistry, "utf8"))) {
  console.error("Folder standalone bukan games pack lengkap atau masih berupa fallback stub.");
  process.exit(1);
}

if (fs.existsSync(packDir)) {
  const localRegistry = path.join(packDir, "games-registry.ts");
  if (!fs.existsSync(localRegistry) || !/GAME_PACK_AVAILABLE\s*=\s*false/.test(fs.readFileSync(localRegistry, "utf8"))) {
    console.error(`Games pack aktif sudah ada di ${packDir}; attach dibatalkan.`);
    process.exit(1);
  }
  fs.rmSync(packDir, { recursive: true, force: true });
}

fs.mkdirSync(path.dirname(packDir), { recursive: true });
fs.renameSync(standaloneDir, packDir);
console.log(`Games pack terpasang kembali di: ${packDir}`);
console.log("Fallback mode dinonaktifkan; engine kembali lazy-loaded per URL game.");
