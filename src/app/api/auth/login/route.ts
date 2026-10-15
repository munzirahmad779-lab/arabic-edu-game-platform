import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      return NextResponse.json(
        { error: "Konfigurasi server Supabase tidak lengkap." },
        { status: 500 }
      );
    }

    const cookieStore = cookies();
    const response = NextResponse.json({ ok: true });

    const supabase = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const isInvalid =
        error.message === "Invalid login credentials" ||
        error.code === "invalid_credentials";
      return NextResponse.json(
        {
          error: isInvalid
            ? "Email atau kata sandi salah. Silakan periksa kembali."
            : error.message,
        },
        { status: 400 }
      );
    }

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat masuk.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
