const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "check-arena-v5.cjs");
let s = fs.readFileSync(p, "utf8");
const before = s;
s = s.replace('page.locator("header .tabular-nums").first()', 'page.locator("[data-timer]")');
fs.writeFileSync(p, s, "utf8");
console.log("checker timer selector:", before !== s ? "ok" : "GAGAL");
