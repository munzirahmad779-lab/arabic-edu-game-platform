/**
 * Menjalankan Next untuk mode produksi dengan folder build terpisah
 * (.next-prod), supaya bisa hidup berdampingan dengan `next dev` (.next).
 *
 *   node scripts/prod-next.cjs build
 *   node scripts/prod-next.cjs start [port]
 */
const { spawn } = require("child_process");
const path = require("path");

const mode = process.argv[2] || "start";
const port = process.argv[3] || "3200";
const root = path.resolve(__dirname, "..");

process.env.NEXT_DIST_DIR = ".next-prod";

const args = mode === "build" ? ["build"] : ["start", "-p", port];
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

console.log(`[prod-next] NEXT_DIST_DIR=.next-prod → next ${args.join(" ")}`);
const child = spawn(process.execPath, [nextBin, ...args], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});
child.on("exit", (code) => process.exit(code ?? 0));
