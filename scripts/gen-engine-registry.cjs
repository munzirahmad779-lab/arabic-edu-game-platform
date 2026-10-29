/**
 * Generates the loader-only games pack manifest.
 * Usage: node scripts/gen-engine-registry.cjs
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const enginesDir = path.join(root, "src", "modules", "games-pack", "engines");
const output = path.join(root, "src", "modules", "games-pack", "games-registry.ts");

if (!fs.existsSync(enginesDir)) {
  console.error(`Engine directory missing: ${enginesDir}`);
  process.exit(1);
}

const slugs = fs
  .readdirSync(enginesDir)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => file.slice(0, -4))
  .sort();

const quote = (slug) => JSON.stringify(slug);
const entries = slugs
  .map((slug) => `  ${quote(slug)}: () => import(${quote(`./engines/${slug}`)}),`)
  .join("\n");

const body = `import type { ComponentType } from "react";
import { GAME_CATALOG, GAME_SLUGS } from "@/lib/game-catalog";

export type GameLoader = () => Promise<{ default: ComponentType }>;

export const GAME_REGISTRY: Record<string, GameLoader> = {
${entries}
};

export const GAME_PACK_AVAILABLE = true;
export { GAME_CATALOG, GAME_SLUGS };

export function hasGameEngine(slug: string): boolean {
  return Boolean(GAME_REGISTRY[slug]);
}
`;

fs.writeFileSync(output, body, "utf8");
console.log(`loader registry written with ${slugs.length} engines: ${output}`);
