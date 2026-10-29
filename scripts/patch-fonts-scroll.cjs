/**
 * 1. Default layout = panel bawah (sesuai pilihan user).
 * 2. Font panel dikecilkan (tidak terlalu besar).
 * 3. Soal panjang: panel bisa di-scroll; bug "tidak bisa scroll ke atas"
 *    diperbaiki dengan menghapus flex-center + overflow pada kotak soal
 *    (flex centering + overflow memotong bagian atas konten).
 */
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

// 1. default panel bawah
sub(
  'useState<"side-lg" | "side-md" | "bottom">("side-md")',
  'useState<"side-lg" | "side-md" | "bottom">("bottom")',
  "default-bawah",
);

// 2. wadah: panel bawah boleh scroll kalau soal panjang, tinggi dibatasi supaya arena tetap besar
sub(
  '      : "border-t " + (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"));',
  '      : "max-h-[46vh] overflow-y-auto border-t " +\n        (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"));',
  "bawah-scroll",
);

// 3. kotak soal: tanpa max-height & tanpa overflow (sumber bug scroll), tinggi mengikuti isi
sub(
  '<div className={`mb-1.5 flex items-center justify-center overflow-y-auto rounded-xl bg-black/30 px-2 py-1.5 ring-1 ${theme.ring} ${isSide ? "max-h-[108px] min-h-[64px]" : "max-h-[74px] min-h-[46px]"}`}>',
  '<div className={`mb-1.5 flex items-center justify-center rounded-xl bg-black/30 px-2 py-1.5 ring-1 ${theme.ring} ${isSide ? "min-h-[56px]" : "min-h-[42px]"}`}>',
  "kotak-soal",
);

// 4. panel: boleh di-scroll sendiri kalau isinya melebihi tinggi baris
sub(
  'className={`rounded-2xl border-2 ${theme.border} ${theme.panel} ${isSide ? "p-2.5" : "p-2"} ${flash ? `ring-4 ${theme.ring}` : ""}`}',
  'className={`overflow-y-auto rounded-2xl border-2 ${theme.border} ${theme.panel} ${isSide ? "p-2.5" : "p-2"} ${flash ? `ring-4 ${theme.ring}` : ""}`}',
  "panel-scroll",
);

// 5. font soal dikecilkan
sub(
  `className={\`text-center font-bold leading-snug text-white \${
                        q?.isArabic
                          ? isSide
                            ? "text-lg sm:text-xl"
                            : "text-base sm:text-lg"
                          : isSide
                            ? "text-[13px] sm:text-[15px]"
                            : "text-[12px] sm:text-[13px]"
                      }\`}`,
  `className={\`text-center font-bold leading-snug text-white \${
                        q?.isArabic
                          ? isSide
                            ? "text-[14px] sm:text-[15px]"
                            : "text-[12px] sm:text-[14px]"
                          : isSide
                            ? "text-[12px] sm:text-[13px]"
                            : "text-[11px] sm:text-[12px]"
                      }\`}`,
  "font-soal",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
