/**
 * Verifies the universal dynamic route used by every game slug.
 * The route is intentionally one file: src/app/games/[gameSlug]/page.tsx.
 */
const fs = require("fs");
const path = require("path");

const route = path.resolve(process.cwd(), "src", "app", "games", "[gameSlug]", "page.tsx");
if (!fs.existsSync(route)) {
  console.error(`Universal game route missing: ${route}`);
  process.exit(1);
}

const source = fs.readFileSync(route, "utf8");
if (!source.includes("GamePackRuntime") || !source.includes("params.gameSlug")) {
  console.error("Universal game route is not wired to GamePackRuntime.");
  process.exit(1);
}

console.log("universal game route verified: src/app/games/[gameSlug]/page.tsx");
