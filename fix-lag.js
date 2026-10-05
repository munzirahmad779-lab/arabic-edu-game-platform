const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function patch(relPath, replacements) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) {
    console.log(`SKIP (tidak ada): ${relPath}`);
    return;
  }
  let content = fs.readFileSync(full, "utf8");
  fs.writeFileSync(full + ".bak", content);
  let ok = 0;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      ok++;
    } else {
      console.log(`  TIDAK KETEMU di ${relPath}:`);
      console.log(`    ${from.slice(0, 60).replace(/\n/g, " ")}...`);
    }
  }
  fs.writeFileSync(full, content);
  console.log(`${relPath}: ${ok}/${replacements.length} patch diterapkan`);
}

patch("src/app/join/room/page.tsx", [
  ["const HEARTBEAT_INTERVAL_MS = 5000;", "const HEARTBEAT_INTERVAL_MS = 10000;"],
]);

patch("src/app/join/room/page.tsx", [
  [
    "const lastHeartbeatRef = useRef(0);",
    "const lastHeartbeatRef = useRef(0);\n  const lastPollRef = useRef(0);",
  ],
]);

patch("src/app/join/room/page.tsx", [
  [
    `    const timer = window.setInterval(() => {
      const nowTs = Date.now();
      setNow(nowTs);

      if (roomStateRef.current !== "ended" && !sessionEnded) {
        void loadSession();
        void loadLeaderboard();
      }

      if (nowTs - lastHeartbeatRef.current > HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatRef.current = nowTs;
        void sendHeartbeat();
      }
    }, 1000);`,
    `    const timer = window.setInterval(() => {
      const nowTs = Date.now();
      setNow(nowTs);

      const state = roomStateRef.current;
      if (state === "ended" || sessionEnded) return;

      const pollInterval = state === "waiting" ? 2500 : 1500;
      if (nowTs - lastPollRef.current > pollInterval) {
        lastPollRef.current = nowTs;
        void loadSession();
        void loadLeaderboard();
      }

      if (nowTs - lastHeartbeatRef.current > HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatRef.current = nowTs;
        void sendHeartbeat();
      }
    }, 1000);`,
  ],
]);

patch(
  "src/app/dashboard/games/[gameId]/room/room-lobby.tsx",
  [
    [
      `    const fallback = window.setInterval(() => {
      setNow(Date.now());
      refresh();
    }, 2000);`,
      `    let lastRefresh = 0;
    const fallback = window.setInterval(() => {
      const nowTs = Date.now();
      setNow(nowTs);
      if (nowTs - lastRefresh > 2500) {
        lastRefresh = nowTs;
        refresh();
      }
    }, 1000);`,
    ],
  ],
);

console.log("\nSelesai. Backup file tersimpan dengan ekstensi .bak");
console.log("Kalau ada yang 'TIDAK KETEMU', kirim output itu ke saya.");