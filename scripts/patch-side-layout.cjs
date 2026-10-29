/**
 * Layout baru: arena di kiri, panel soal di kanan (kolom besar).
 * Bisa ditukar ke "panel di bawah" lewat tombol di header.
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

// A. state layout
sub(
  "  const [confirmQuit, setConfirmQuit] = useState(false);",
  '  const [confirmQuit, setConfirmQuit] = useState(false);\n  const [layout, setLayout] = useState<"side" | "bottom">("side");',
  "state-layout",
);

// B. default bawah untuk layar kecil
sub(
  `  useEffect(() => {
    saveSettings(settings);
  }, [settings]);`,
  `  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) setLayout("bottom");
  }, []);`,
  "layout-kecil",
);

// C. variabel turunan
sub(
  '  const modeLabel = mode === "SQUAD" ? "2 vs 2" : "1 vs 1";',
  `  const modeLabel = mode === "SQUAD" ? "2 vs 2" : "1 vs 1";
  const isSide = layout === "side";
  const panelWrap =
    "grid shrink-0 gap-2 border-slate-800 bg-slate-950 p-2 " +
    (isSide
      ? "auto-rows-fr overflow-y-auto border-t lg:h-full lg:w-[40%] lg:max-w-[580px] lg:border-l lg:border-t-0 lg:p-3 " +
        (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-1" : "grid-cols-2 lg:grid-cols-1")
      : "border-t " + (mode === "SQUAD" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"));`,
  "panel-wrap-var",
);

// D. tombol tukar layout di header
sub(
  '              <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-300">{modeLabel}</span>',
  `              <button
                onClick={() => setLayout((l) => (l === "side" ? "bottom" : "side"))}
                className="hidden rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-200 lg:block"
                title={isSide ? "Pindahkan panel ke bawah" : "Pindahkan panel ke samping"}
              >
                {isSide ? "⇩ BAWAH" : "⇔ SAMPING"}
              </button>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-300">{modeLabel}</span>`,
  "tombol-layout",
);

// E. bungkus arena + panel jadi baris
sub(
  '          <div ref={wrapRef} className="relative min-h-0 flex-1 bg-gradient-to-b from-sky-200 to-emerald-100">',
  '          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">\n          <div ref={wrapRef} className="relative min-h-0 flex-1 bg-gradient-to-b from-sky-200 to-emerald-100">',
  "wrapper-buka",
);

// F. kelas wadah panel
sub(
  `          <div
            className={\`grid shrink-0 gap-2 border-t border-slate-800 bg-slate-950 p-2 \${
              mode === "SQUAD" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
            }\`}
            data-slots={slots.length}
          >`,
  '          <div className={panelWrap} data-slots={slots.length} data-layout={layout}>',
  "panel-wrap",
);

// G. tutup wrapper
sub(
  `          </div>
          <div className="shrink-0 bg-slate-950 pb-1 text-center text-[10px] font-bold text-slate-500">`,
  `          </div>
          </div>
          <div className="shrink-0 bg-slate-950 pb-1 text-center text-[10px] font-bold text-slate-500">`,
  "wrapper-tutup",
);

// H. ukuran isi panel
sub(
  'className={`rounded-2xl border-2 ${theme.border} ${theme.panel} p-2 ${flash ? `ring-4 ${theme.ring}` : ""}`}',
  'className={`rounded-2xl border-2 ${theme.border} ${theme.panel} ${isSide ? "p-2.5" : "p-2"} ${flash ? `ring-4 ${theme.ring}` : ""}`}',
  "panel-padding",
);

sub(
  '<div className={`mb-1.5 flex max-h-[74px] min-h-[46px] items-center justify-center overflow-y-auto rounded-xl bg-black/30 px-2 py-1.5 ring-1 ${theme.ring}`}>',
  '<div className={`mb-1.5 flex items-center justify-center overflow-y-auto rounded-xl bg-black/30 px-2 py-1.5 ring-1 ${theme.ring} ${isSide ? "max-h-[108px] min-h-[64px]" : "max-h-[74px] min-h-[46px]"}`}>',
  "kotak-soal-besar",
);

sub(
  'className={`text-center font-bold leading-snug text-white ${q?.isArabic ? "text-base sm:text-lg" : "text-[12px] sm:text-[13px]"}`}',
  'className={`text-center font-bold leading-snug text-white ${\n                        q?.isArabic\n                          ? isSide\n                            ? "text-lg sm:text-xl"\n                            : "text-base sm:text-lg"\n                          : isSide\n                            ? "text-[13px] sm:text-[15px]"\n                            : "text-[12px] sm:text-[13px]"\n                      }`}',
  "teks-soal-besar",
);

sub(
  'className={`flex min-h-[44px] items-center justify-center gap-1 rounded-lg border ${theme.option} px-1.5 py-1 text-center text-[12px] font-bold leading-tight text-white shadow active:scale-95 sm:min-h-[50px] sm:text-[13px]`}',
  'className={`flex items-center justify-center gap-1 rounded-lg border ${theme.option} text-center font-bold leading-tight text-white shadow active:scale-95 ${\n                          isSide\n                            ? "min-h-[54px] px-2 py-1.5 text-[13px] sm:min-h-[58px] sm:text-sm"\n                            : "min-h-[44px] px-1.5 py-1 text-[12px] sm:min-h-[50px] sm:text-[13px]"\n                        }`}',
  "tombol-opsi-besar",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
