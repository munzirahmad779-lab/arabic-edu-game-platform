/** Perbaiki selector yang rusak di check-adu-tarik.cjs (baris 77-79). */
const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "check-adu-tarik.cjs");
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);

// cari baris yang mengandung 'getByRole("button", { name: new RegExp'
const idx = lines.findIndex((l) => l.includes("new RegExp("));
if (idx < 0) {
  console.error("baris rusak tidak ditemukan");
  process.exit(1);
}
lines[idx] = '      : page.getByRole("button", { name: target }).first();';
fs.writeFileSync(p, lines.join("\n"), "utf8");
console.log("diperbaiki baris", idx + 1, "->", lines[idx].trim());
