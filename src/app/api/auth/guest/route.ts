import { NextResponse } from "next/server";

const GUEST_COOKIE = "guest_session";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/login", url.origin), 303);
  response.cookies.set(GUEST_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/login", url.origin), 303);
  response.cookies.set(GUEST_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
