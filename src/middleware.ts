import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Halaman /lab adalah alat uji internal: di produksi seluruh subtree
  // ini menjawab 404. Penjaga ditaruh di middleware karena notFound()
  // di lab/layout.tsx terbukti tidak menghasilkan status 404 untuk
  // halaman di bawahnya (terverifikasi pada build produksi lokal dan
  // di produksi 10 Nov 2026: /lab/motion tetap 200).
  if (
    process.env.NODE_ENV === "production" &&
    request.nextUrl.pathname.startsWith("/lab")
  ) {
    return new NextResponse(null, { status: 404 });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Dashboard dan game mandiri (/game) memerlukan refresh/validasi sesi.
    // Public pages (home, login, join, controller) should not pay that edge
    // invocation on every navigation.
    "/dashboard/:path*",
    "/game/:path*",
    "/lab/:path*",
  ],
};
