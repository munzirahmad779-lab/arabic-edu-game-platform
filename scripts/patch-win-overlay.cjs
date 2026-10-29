/**
 * Overlay pemenang jangan menutup arena — supaya tim yang kalah
 * kelihatan benar-benar terseret. Ganti jadi banner atas + tombol bawah.
 */
const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let s = fs.readFileSync(file, "utf8");

const startMark = "            {winner && (";
const endMark = "          {/* PANEL SOAL";
const i0 = s.indexOf(startMark);
const i1 = s.indexOf(endMark);
if (i0 < 0 || i1 < 0 || i1 < i0) {
  console.error("blok overlay tidak ditemukan", i0, i1);
  process.exit(1);
}

const replacement = `            {winner && (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-1 bg-gradient-to-b from-slate-950/90 via-slate-950/55 to-transparent px-4 pb-10 pt-3 text-center">
                  <div
                    className={\`rounded-full bg-gradient-to-r px-4 py-0.5 text-[10px] font-black tracking-[0.25em] \${
                      winner === "p1"
                        ? "from-cyan-400 to-blue-600"
                        : winner === "p2"
                          ? "from-amber-400 to-orange-600"
                          : "from-slate-500 to-slate-700"
                    }\`}
                  >
                    {winner === "draw" ? "DRAW" : "WINNER"}
                  </div>
                  <h3 className="text-2xl font-black text-amber-300 drop-shadow sm:text-4xl">
                    {winner === "draw" ? t.draw : \`\${winner === "p1" ? TEAM_LABEL.left : TEAM_LABEL.right} \${t.win}\`}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-300">
                    {TEAM_LABEL.left} {teamScore("p1")} · {TEAM_LABEL.right} {teamScore("p2")} · {mode}
                  </p>
                </div>
                <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-wrap justify-center gap-2 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent px-4 pb-2 pt-10">
                  <button
                    onClick={() => startMatch(subject)}
                    className={\`\${btn} bg-gradient-to-r from-amber-300 to-orange-500 px-5 py-2 text-base text-slate-950\`}
                  >
                    {t.again}
                  </button>
                  <button
                    onClick={() => {
                      setWinner(null);
                      winnerRef.current = null;
                      resultRef.current = null;
                      setScreen("topic");
                    }}
                    className={\`\${btn} bg-slate-700 px-5 py-2 text-base\`}
                  >
                    {t.topic}
                  </button>
                  <button
                    onClick={() => {
                      setWinner(null);
                      winnerRef.current = null;
                      resultRef.current = null;
                      setScreen("home");
                    }}
                    className={\`\${btn} bg-slate-700 px-5 py-2 text-base\`}
                  >
                    {t.home}
                  </button>
                </div>
              </>
            )}
`;

s = s.slice(0, i0) + replacement + s.slice(i1);
fs.writeFileSync(file, s, "utf8");
console.log("overlay diganti, bytes:", s.length);
