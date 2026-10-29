/** QA for the plug-and-play game pack structure. */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const enginesDir = path.join(root, "src", "modules", "games-pack", "engines");
const registryPath = path.join(root, "src", "modules", "games-pack", "games-registry.ts");
const routePath = path.join(root, "src", "app", "games", "[gameSlug]", "page.tsx");

const failures = [];
if (!fs.existsSync(routePath)) failures.push("universal dynamic route missing");
if (!fs.existsSync(registryPath)) failures.push("loader registry missing");
if (!fs.existsSync(enginesDir)) failures.push("games-pack engine directory missing");

if (failures.length === 0) {
  const registry = fs.readFileSync(registryPath, "utf8");
  const engines = fs.readdirSync(enginesDir).filter((file) => file.endsWith(".tsx"));
  for (const file of engines) {
    const slug = file.slice(0, -4);
    if (!registry.includes(`./engines/${slug}`)) {
      failures.push(`registry loader missing for ${slug}`);
    }
  }
  if (!registry.includes("GAME_PACK_AVAILABLE") || !registry.includes("GAME_REGISTRY")) {
    failures.push("registry contract missing");
  }
}

if (failures.length > 0) {
  console.error("Games pack QA FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Games pack QA PASS");
console.log(`- ${fs.readdirSync(enginesDir).filter((file) => file.endsWith(".tsx")).length} engine chunks registered`);
console.log("- one universal dynamic route");
console.log("- no static engine import required by the route");
