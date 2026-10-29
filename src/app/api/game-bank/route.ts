import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  getBankQuestionsForGame,
  listTeacherBanksForGames,
} from "@/lib/game-bank-feed";

/**
 * Umpan Bank Soal LMS untuk game mandiri (hot-seat).
 * GET tanpa parameter: daftar bank milik guru yang login.
 * GET ?bankId=<uuid>: soal bank itu dalam bentuk netral.
 * Hanya untuk sesi guru; tamu menerima 401.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const bankId = new URL(request.url).searchParams.get("bankId");
  if (!bankId) {
    const banks = await listTeacherBanksForGames(user.id);
    return NextResponse.json({ banks });
  }

  const questions = await getBankQuestionsForGame(user.id, bankId);
  if (questions === null) {
    return NextResponse.json({ error: "BANK_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ questions });
}
