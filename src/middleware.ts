import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Dashboard dan game mandiri (/game) memerlukan refresh/validasi sesi.
    // Public pages (home, login, join, controller) should not pay that edge
    // invocation on every navigation.
    "/dashboard/:path*",
    "/game/:path*",
  ],
};
