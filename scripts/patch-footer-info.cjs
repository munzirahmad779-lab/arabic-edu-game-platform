/** Footer menampilkan layout & lebar jendela (untuk memastikan build yang dipakai). */
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
  '  const [layout, setLayout] = useState<"side-lg" | "side-md" | "bottom">("side-md");',
  '  const [layout, setLayout] = useState<"side-lg" | "side-md" | "bottom">("side-md");\n  const [vw, setVw] = useState(0);',
  "state-vw",
);

sub(
  `  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) setLayout("bottom");
  }, []);`,
  `  useEffect(() => {
    const sync = () => setVw(window.innerWidth);
    sync();
    if (window.innerWidth < 640) setLayout("bottom");
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);`,
  "vw-effect",
);

sub(
  '            {t.tap} · ESC = {t.quit.toLowerCase()}',
  '            {t.tap} · ESC = {t.quit.toLowerCase()} · <span className="text-slate-600">layout {layout} · {vw}px</span>',
  "footer-info",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
