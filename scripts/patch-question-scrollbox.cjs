/**
 * Kotak soal: tinggi dibatasi (supaya arena tetap besar) + bisa di-scroll,
 * dengan trik min-height pada pembungkus dalam sehingga teks tidak terpotong di atas.
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

sub(
  '<div className={`mb-1.5 flex items-center justify-center rounded-xl bg-black/30 px-2 py-1.5 ring-1 ${theme.ring} ${isSide ? "min-h-[56px]" : "min-h-[42px]"}`}>',
  '<div className={`mb-1.5 overflow-y-auto overscroll-contain rounded-xl bg-black/30 ring-1 ${theme.ring} ${isSide ? "max-h-[112px]" : "max-h-[88px]"}`}>\n                    <div className={`flex flex-col justify-center px-2 py-1.5 ${isSide ? "min-h-[58px]" : "min-h-[46px]"}`}>',
  "kotak-soal-scroll",
);

// tutup div tambahan tepat setelah span soal
sub(
  `                      {q?.prompt ?? "Soal habis — bank kosong"}
                    </span>
                  </div>`,
  `                      {q?.prompt ?? "Soal habis — bank kosong"}
                    </span>
                    </div>
                  </div>`,
  "kotak-soal-tutup",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
