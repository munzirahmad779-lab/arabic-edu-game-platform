/**
 * Patch Game.tsx: ganti mesin canvas lama dengan renderer baru (render.ts).
 * Dijalankan sekali: node scripts/patch-arena-render.cjs
 */
const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let src = fs.readFileSync(file, "utf8");

const startMarker = "  /* --------------------------- canvas loop --------------------------- */";
const endMarker = "  const q = questions;";
const a = src.indexOf(startMarker);
const b = src.indexOf(endMarker);
if (a < 0 || b < 0 || b < a) {
  console.error("marker tidak ditemukan", a, b);
  process.exit(1);
}

const replacement = `  /* --------------------------- arena renderer --------------------------- */
  useEffect(() => {
    if (screen !== "playing" && screen !== "result") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const pair = mode === "SQUAD" ? 2 : 1;
    const view: ArenaView = {
      rope: ropeRef,
      frame: frameRef,
      shake: shakeRef,
      mode,
      winLimit: RULES.winLimit,
      maxOffset: RULES.maxOffset,
      leftChars: [...SIDE_CHARS.left].slice(0, pair),
      rightChars: [...SIDE_CHARS.right].slice(0, pair),
      images: imgsRef,
      active: true,
    };
    const handle = runArena(canvas, wrap, view);
    arenaRef.current = handle;
    return () => {
      view.active = false;
      handle.stop();
      arenaRef.current = null;
    };
  }, [screen, mode]);

`;

src = src.slice(0, a) + replacement + src.slice(b);

// import renderer + konstanta tim
src = src.replace(
  'import { CHARACTERS, FRAME, getFrameCrop } from "./sprites";',
  'import { CHARACTERS, FRAME, SIDE_CHARS, TEAM_LABEL } from "./sprites";\nimport { runArena, type ArenaHandle, type ArenaView } from "./render";',
);

// refs: arena handle, hapus particle/refs lama yang tidak dipakai renderer
src = src.replace(
  "  const particlesRef = useRef<Particle[]>([]);\n",
  "",
);
src = src.replace(
  "type Particle = { x: number; y: number; vx: number; vy: number; life: number; c: string; r: number };\n",
  "",
);
src = src.replace(
  "  const imgsRef = useRef<Record<string, HTMLImageElement>>({});",
  "  const imgsRef = useRef<Record<string, HTMLImageElement>>({});\n  const arenaRef = useRef<ArenaHandle | null>(null);",
);

// efek partikel lama di answer()
src = src.replace(
  `        beep("ok");
        for (let i = 0; i < 14; i++) {
          particlesRef.current.push({
            x: 0.5 + dir * 0.18,
            y: 0.78,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -Math.random() * 0.4,
            life: 1,
            c: "#e8d7b0",
            r: 1 + Math.random() * 2,
          });
        }`,
  `        beep("ok");
        arenaRef.current?.emitDust(side, 1.25);`,
);
src = src.replace(
  `        beep("no");
      }
      setScores({ ...scoreRef.current });
      particlesRef.current = particlesRef.current.slice(-PARTICLE_BUDGET);`,
  `        beep("no");
        arenaRef.current?.emitDust(side, 0.55);
      }
      setScores({ ...scoreRef.current });`,
);

// konfeti saat menang
src = src.replace(
  `      if (w !== "draw") {
        beep("win");
        for (let i = 0; i < 60; i++) {
          particlesRef.current.push({
            x: Math.random(),
            y: 0.2,
            vx: (Math.random() - 0.5) * 0.6,
            vy: Math.random() * 0.5 + 0.2,
            life: 1,
            c: ["#ffd166", "#7ef0b0", "#8fd3ff", "#f2a6c4"][i % 4],
            r: 2 + Math.random() * 3,
          });
        }
      }`,
  `      if (w !== "draw") {
        beep("win");
        arenaRef.current?.emitConfetti();
      }`,
);

// nama pemenang + label tim
src = src.replace(
  `winnerName: w === "draw" ? "Seri" : w === "p1" ? "Tim Maleo" : "Tim Tarsius",`,
  `winnerName: w === "draw" ? "Seri" : w === "p1" ? TEAM_LABEL.left : TEAM_LABEL.right,`,
);
src = src.replace(
  `{winner === "draw" ? t.draw : \`\${winner === "p1" ? "TIM MALEO" : "TIM TARSIUS"} \${t.win}\`}`,
  `{winner === "draw" ? t.draw : \`\${winner === "p1" ? TEAM_LABEL.left : TEAM_LABEL.right} \${t.win}\`}`,
);
src = src.replace(
  `              <span className="text-cyan-400">P1 {scores.p1}</span>
              <span className="text-orange-400">P2 {scores.p2}</span>`,
  `              <span className="text-cyan-400">{TEAM_LABEL.left} {scores.p1}</span>
              <span className="text-orange-400">{TEAM_LABEL.right} {scores.p2}</span>`,
);

fs.writeFileSync(file, src, "utf8");
console.log("Game.tsx dipatch:", src.length, "byte");
