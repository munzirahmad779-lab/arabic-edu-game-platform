export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) return NextResponse.json([]);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "student_get_my_room_answers",
      { p_join_token: token },
    );

    if (error) {
      console.error("[/api/rooms/review] RPC error:", error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("[/api/rooms/review] Unexpected error:", error);
    return NextResponse.json([]);
  }
}
