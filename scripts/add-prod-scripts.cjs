const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
pkg.scripts["build:prod"] = "node scripts/prod-next.cjs build";
pkg.scripts["start:prod"] = "node scripts/prod-next.cjs start 3200";
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("scripts:", JSON.stringify({ build: pkg.scripts.build, "build:prod": pkg.scripts["build:prod"], "start:prod": pkg.scripts["start:prod"] }, null, 2));
