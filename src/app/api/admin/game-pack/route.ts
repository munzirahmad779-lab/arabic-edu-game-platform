import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/super-admin";

const repoRoot = process.cwd();
const packDir = path.join(repoRoot, "src", "modules", "games-pack");
const standaloneDir = path.resolve(
  process.env.MAGGURU_GAMES_PACK_DIR ?? path.join(repoRoot, "..", "magguru-games-pack-standalone"),
);
const registryName = "games-registry.ts";
const detachedStub = `/** Generated fallback. */
import type { ComponentType } from "react";
export type GameLoader = () => Promise<{ default: ComponentType }>;
export const GAME_PACK_AVAILABLE = false;
export const GAME_REGISTRY: Record<string, GameLoader> = {};
export const GAME_SLUGS: readonly string[] = [];
export const GAME_CATALOG: readonly never[] = [];
export function hasGameEngine(_slug: string): boolean { return false; }
`;

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return isSuperAdmin(user);
}

async function exists(target: string) {
  try { await fs.access(target); return true; } catch { return false; }
}

export async function GET() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const detached = await exists(path.join(packDir, registryName)) &&
    (await fs.readFile(path.join(packDir, registryName), "utf8")).includes("GAME_PACK_AVAILABLE = false");
  return NextResponse.json({ attached: !detached, standalonePath: standaloneDir });
}

export async function POST(request: Request) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = body?.action === "detach" ? "detach" : body?.action === "attach" ? "attach" : null;
  if (!action) return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });

  if (action === "detach") {
    if (!(await exists(packDir))) return NextResponse.json({ error: "PACK_NOT_FOUND" }, { status: 404 });
    if (await exists(standaloneDir)) return NextResponse.json({ error: "STANDALONE_EXISTS" }, { status: 409 });
    await fs.mkdir(path.dirname(standaloneDir), { recursive: true });
    await fs.rename(packDir, standaloneDir);
    await fs.mkdir(packDir, { recursive: true });
    await fs.writeFile(path.join(packDir, registryName), detachedStub, "utf8");
  } else {
    if (!(await exists(standaloneDir))) return NextResponse.json({ error: "STANDALONE_NOT_FOUND" }, { status: 404 });
    const registry = path.join(standaloneDir, registryName);
    if (!(await exists(registry)) || (await fs.readFile(registry, "utf8")).includes("GAME_PACK_AVAILABLE = false")) {
      return NextResponse.json({ error: "INVALID_STANDALONE_PACK" }, { status: 400 });
    }
    if (await exists(packDir)) await fs.rm(packDir, { recursive: true, force: true });
    await fs.rename(standaloneDir, packDir);
  }
  return NextResponse.json({ ok: true, attached: action === "attach" });
}
