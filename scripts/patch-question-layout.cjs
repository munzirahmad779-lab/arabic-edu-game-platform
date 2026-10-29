/** Pastikan panel soal + 4 opsi selalu terlihat (canvas mengecil, bukan panel terdorong). */
const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let s = fs.readFileSync(file, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

// 1. wrapper canvas harus boleh mengecil
sub(
  '<div ref={wrapRef} className="relative flex-1 bg-sky-100">',
  '<div ref={wrapRef} className="relative min-h-0 flex-1 bg-sky-100">',
  "canvas-wrapper",
);

// 2. canvas absolut agar tinggi intrinsiknya tidak memaksa layout
sub(
  '<canvas ref={canvasRef} className="h-full w-full" />',
  '<canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />',
  "canvas-absolute",
);

// 3. panel soal tidak boleh menyusut/terdorong
sub(
  '<div className="grid grid-cols-1 gap-3 border-t border-slate-800 bg-slate-900 p-3 sm:grid-cols-2">',
  '<div className="grid shrink-0 grid-cols-1 gap-2 border-t border-slate-800 bg-slate-900 p-2 sm:grid-cols-2 sm:gap-3 sm:p-3">',
  "panel-container",
);

// 4. kotak soal: scroll internal, tidak menutupi opsi
sub(
  '<div className="mb-2 flex min-h-[54px] items-center justify-center rounded-xl bg-slate-900 px-3 py-2">',
  '<div className="mb-2 flex max-h-[88px] min-h-[52px] items-center justify-center overflow-y-auto rounded-xl bg-slate-900 px-3 py-2">',
  "kotak-soal",
);

sub(
  'className={`text-center font-bold text-slate-100 ${',
  'className={`text-center font-bold leading-snug text-slate-100 ${',
  "teks-soal-leading",
);

sub(
  'panel.qq?.isArabic ? "text-xl leading-relaxed" : "text-sm"',
  'panel.qq?.isArabic ? "text-lg sm:text-xl" : "text-[13px] sm:text-sm"',
  "teks-soal-size",
);

// 5. opsi: label A-D, teks boleh turun baris, tinggi seragam
sub(
  `                <div className="grid grid-cols-2 gap-2">
                  {(panel.qq?.options ?? []).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => answer(panel.side, opt)}
                      dir={panel.qq?.isArabic ? "rtl" : "ltr"}
                      className={\`\${panel.bg} min-h-[52px] rounded-xl px-2 py-2 text-center text-sm font-bold text-white shadow active:scale-95\`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>`,
  `                <div className="grid grid-cols-2 gap-2">
                  {(panel.qq?.options ?? []).map((opt, oi) => (
                    <button
                      key={opt}
                      onClick={() => answer(panel.side, opt)}
                      dir={panel.qq?.isArabic ? "rtl" : "ltr"}
                      className={\`\${panel.bg} flex min-h-[54px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-[13px] font-bold leading-tight text-white shadow active:scale-95 sm:text-sm\`}
                    >
                      <span className="shrink-0 rounded bg-black/25 px-1 text-[10px]">{"ABCD"[oi] ?? oi + 1}</span>
                      <span className="break-words">{opt}</span>
                    </button>
                  ))}
                </div>`,
  "opsi-abcd",
);

fs.writeFileSync(file, s, "utf8");
console.log(log.join("\n"));
