/**
 * Tiga mode tata letak:
 *   side-lg  : panel samping lebar (44%)  → panel besar, arena sedang
 *   side-md  : panel samping sedang (34%) → arena lebih lega, panel tetap besar
 *   bottom   : panel di bawah (arena selebar layar)
 * Tombol di header memutar ketiganya.
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
  '  const [layout, setLayout] = useState<"side" | "bottom">("side");',
  '  const [layout, setLayout] = useState<"side-lg" | "side-md" | "bottom">("side-lg");',
  "state-layout3",
);

sub(
  '      ? "auto-rows-fr overflow-y-auto border-t lg:h-full lg:w-[44%] lg:max-w-[660px] lg:border-l lg:border-t-0 lg:p-3 " +\n        (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-2" : "grid-cols-2 lg:grid-cols-1")',
  `      ? "auto-rows-fr overflow-y-auto border-t lg:h-full lg:border-l lg:border-t-0 lg:p-3 " +
        (layout === "side-lg" ? "lg:w-[44%] lg:max-w-[660px] " : "lg:w-[34%] lg:max-w-[520px] ") +
        (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-2" : "grid-cols-2 lg:grid-cols-1")`,
  "panel-wrap-3mode",
);

sub(
  '  const isSide = layout === "side";',
  '  const isSide = layout !== "bottom";',
  "is-side",
);

sub(
  `              <button
                onClick={() => setLayout((l) => (l === "side" ? "bottom" : "side"))}
                className="hidden rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-200 lg:block"
                title={isSide ? "Pindahkan panel ke bawah" : "Pindahkan panel ke samping"}
              >
                {isSide ? "⇩ BAWAH" : "⇔ SAMPING"}
              </button>`,
  `              <button
                onClick={() =>
                  setLayout((l) => (l === "side-lg" ? "side-md" : l === "side-md" ? "bottom" : "side-lg"))
                }
                className="hidden rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-200 lg:block"
                title="Ganti tata letak: panel lebar / panel sedang / panel di bawah"
              >
                {layout === "side-lg" ? "⇔ PANEL SEDANG" : layout === "side-md" ? "⇩ PANEL BAWAH" : "⇔ PANEL LEBAR"}
              </button>`,
  "tombol-3mode",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
