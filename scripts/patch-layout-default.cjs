const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

// default: panel samping sedang (arena lebih lega, panel tetap besar)
sub('useState<"side-lg" | "side-md" | "bottom">("side-lg")', 'useState<"side-lg" | "side-md" | "bottom">("side-md")', "default-sedang");

// mode bawah: SQUAD jadi 4 kolom supaya arena tetap tinggi
sub(
  '      : "border-t " + (mode === "SQUAD" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"));',
  '      : "border-t " + (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"));',
  "bawah-4kolom",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
