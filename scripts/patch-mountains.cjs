/**
 * Patch render.ts -> v4:
 *  - karakter lebih besar (68% tinggi kanvas)
 *  - Tarsius/Anoa digeser ke tengah (0.30w), Maleo/Yaki 0.70w
 *  - latar diganti gunung 3D berlapis (facet terang/gelap + salju + bayangan)
 */
const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "render.ts");
let s = fs.readFileSync(file, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

/* 1. ukuran karakter */
sub(
  "const cellOf = () => Math.min(h * 0.5, w * 0.2);",
  "const cellOf = () => Math.min(h * 0.68, w * 0.27);",
  "cellOf",
);

/* 2. posisi kaki: lebih ke tengah */
sub(
  `    const base = side === "p1" ? w * 0.21 : w * 0.79;
    const dir = side === "p1" ? -1 : 1;
    return { x: base + shift + dir * index * cell * 0.5, y: h * 0.8 };`,
  `    const base = side === "p1" ? w * 0.31 : w * 0.69;
    const dir = side === "p1" ? -1 : 1;
    return { x: base + shift + dir * index * cell * 0.44, y: h * 0.82 };`,
  "feetOf",
);

/* 3. gunung 3D: ganti blok bukit */
const hillsOld = `    const hills: [number, number, number, string][] = [
      [0.2, 0.44, 0.17, "rgba(148,186,158,.35)"],
      [0.58, 0.52, 0.13, "rgba(120,172,132,.42)"],
      [0.86, 0.46, 0.11, "rgba(96,152,110,.5)"],
    ];
    for (const [cx, cw, ch, col] of hills) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(w * cx, groundY, w * cw, h * ch, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    const haze = ctx.createLinearGradient(0, groundY - h * 0.1, 0, groundY);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(1, "rgba(255,255,255,.35)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, groundY - h * 0.1, w, h * 0.1);`;

const hillsNew = `    // ---- gunung 3D (tiga lapis, facet terang/gelap + salju) ----
    for (const layer of scene.mountains) {
      for (const m of layer.peaks) {
        drawMountain(m, layer, now);
      }
      if (layer.haze) {
        const hz = ctx.createLinearGradient(0, layer.base - h * 0.16, 0, layer.base);
        hz.addColorStop(0, "rgba(255,255,255,0)");
        hz.addColorStop(1, \`rgba(255,255,255,\${layer.haze})\`);
        ctx.fillStyle = hz;
        ctx.fillRect(0, layer.base - h * 0.16, w, h * 0.16);
      }
    }
    // perbukitan kaki (menyatukan gunung dengan tanah)
    for (const [cx, cw, ch, col] of scene.foothills) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(w * cx, groundY, w * cw, h * ch, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }`;

sub(hillsOld, hillsNew, "mountains-block");

/* 4. sisipkan generator + drawer gunung sebelum drawChar */
const anchor = "  const drawChar = (";
const mountainCode = `  /* ------------------------------ gunung 3D ------------------------------ */

  const mulberry32 = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  interface Peak {
    x: number;
    w: number;
    h: number;
    snow: number;
    seed: number;
  }
  interface MtnLayer {
    base: number;
    peaks: Peak[];
    light: string;
    dark: string;
    snow: string;
    haze: number;
    ridge: string;
  }

  const scene: { mountains: MtnLayer[]; foothills: [number, number, number, string][] } = {
    mountains: [],
    foothills: [],
  };

  const buildScene = () => {
    const rnd = mulberry32(20261021);
    const groundY = h * 0.82;
    const mk = (n: number, baseOff: number, hmin: number, hmax: number, wmin: number, wmax: number, layer: Omit<MtnLayer, "peaks" | "base">) => {
      const peaks: Peak[] = [];
      for (let i = 0; i < n; i++) {
        const ww = w * (wmin + rnd() * (wmax - wmin));
        peaks.push({
          x: ((i + 0.5) / n) * w + (rnd() - 0.5) * w * 0.22,
          w: ww,
          h: h * (hmin + rnd() * (hmax - hmin)),
          snow: 0.18 + rnd() * 0.12,
          seed: Math.floor(rnd() * 1e6),
        });
      }
      peaks.sort((a, b) => a.h - b.h);
      return { base: groundY + baseOff, peaks, ...layer } as MtnLayer;
    };

    scene.mountains = [
      mk(4, 4, 0.26, 0.42, 0.3, 0.46, {
        light: "#b6cddd",
        dark: "#93aec2",
        snow: "#eef5fa",
        haze: 0.55,
        ridge: "rgba(255,255,255,.35)",
      }),
      mk(3, 0, 0.34, 0.5, 0.34, 0.5, {
        light: "#8ba9b8",
        dark: "#63808f",
        snow: "#f3f8fb",
        haze: 0.28,
        ridge: "rgba(255,255,255,.45)",
      }),
      mk(3, -6, 0.28, 0.42, 0.32, 0.46, {
        light: "#6d8b83",
        dark: "#48635c",
        snow: "#e8f1f2",
        haze: 0,
        ridge: "rgba(255,255,255,.3)",
      }),
    ];

    scene.foothills = [
      [0.16, 0.4, 0.1, "rgba(120,164,124,.5)"],
      [0.62, 0.46, 0.08, "rgba(98,146,108,.55)"],
      [0.9, 0.36, 0.07, "rgba(84,124,92,.5)"],
    ];
  };

  const peakPath = (m: Peak, base: number, inset: number) => {
    const hw = (m.w / 2) * (1 - inset);
    const top = base - m.h * (1 - inset * 0.6);
    return { left: m.x - hw, right: m.x + hw, top };
  };

  const drawMountain = (m: Peak, layer: MtnLayer, now: number) => {
    const base = layer.base;
    const hw = m.w / 2;
    const top = base - m.h;
    void now;

    // badan gunung (facet terang menghadap matahari di kanan)
    const body = ctx.createLinearGradient(m.x - hw, top, m.x + hw, base);
    body.addColorStop(0, layer.dark);
    body.addColorStop(0.55, layer.light);
    body.addColorStop(1, layer.dark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(m.x - hw, base);
    ctx.lineTo(m.x, top);
    ctx.lineTo(m.x + hw, base);
    ctx.closePath();
    ctx.fill();

    // bidang gelap (sisi bayangan) untuk kesan 3D
    const rnd = mulberry32(m.seed)();
    const shadeX = m.x + hw * (0.1 + rnd * 0.18);
    ctx.fillStyle = "rgba(38,58,66,.22)";
    ctx.beginPath();
    ctx.moveTo(m.x, top);
    ctx.lineTo(m.x + hw, base);
    ctx.lineTo(shadeX, base);
    ctx.closePath();
    ctx.fill();

    // punggung terang
    ctx.strokeStyle = layer.ridge;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(m.x, top);
    ctx.lineTo(m.x - hw * 0.96, base);
    ctx.stroke();

    // salju di puncak (zigzag)
    const snowH = m.h * m.snow;
    const steps = 7;
    ctx.fillStyle = layer.snow;
    ctx.beginPath();
    ctx.moveTo(m.x, top);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const y = top + snowH * t * (0.75 + ((m.seed + i * 37) % 10) / 26);
      ctx.lineTo(m.x - hw * t, y);
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const y = top + snowH * t * (0.8 + ((m.seed + i * 53) % 10) / 28);
      ctx.lineTo(m.x + hw * t, y);
    }
    ctx.closePath();
    ctx.fill();

    // bayangan dasar gunung
    const sh = ctx.createLinearGradient(0, base - 2, 0, base + 10);
    sh.addColorStop(0, "rgba(40,60,50,.18)");
    sh.addColorStop(1, "rgba(40,60,50,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(m.x - hw, base - 2, m.w, 12);
  };

  const drawChar = (`;

sub(anchor, mountainCode, "mountain-code");

/* 5. bangun scene saat resize */
sub(
  `  const ro = new ResizeObserver(resize);
  ro.observe(wrap);`,
  `  const ro = new ResizeObserver(() => {
    resize();
    buildScene();
  });
  ro.observe(wrap);`,
  "resize-hook",
);

/* 6. groundY konsisten 0.82 */
sub("    const groundY = h * 0.8;", "    const groundY = h * 0.82;", "groundY-loop");

/* 7. panggil buildScene sekali setelah definition (tepat sebelum loop) */
sub(
  `  let last = performance.now();`,
  `  buildScene();

  let last = performance.now();`,
  "buildScene-call",
);

fs.writeFileSync(file, s, "utf8");
console.log(log.join("\n"));
console.log("bytes:", s.length);
