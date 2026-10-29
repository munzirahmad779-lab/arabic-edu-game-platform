export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const joinToken =
      body && typeof body === "object" && "joinToken" in body
        ? String(body.joinToken ?? "").trim()
        : "";

    if (!joinToken) {
      return NextResponse.json(
        { error: "INVALID_JOIN_TOKEN" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("heartbeat_room_participant", {
      p_join_token: joinToken,
    });

    if (error) {
      console.error("[/api/rooms/heartbeat] RPC error:", error.message);
      return NextResponse.json(
        { error: "HEARTBEAT_FAILED" },
        { status: 500 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[/api/rooms/heartbeat] Unexpected error:", error);
    return NextResponse.json({ error: "HEARTBEAT_FAILED" }, { status: 500 });
  }
}
