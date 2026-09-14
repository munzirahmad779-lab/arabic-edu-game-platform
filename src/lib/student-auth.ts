import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StudentSession = {
  student_id: string;
  name: string;
  class_id: string;
  class_name: string;
};

const COOKIE_NAME = "student_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 hari

/**
 * Baca session siswa dari cookie dan verifikasi ke server.
 * Bisa dipakai di Server Component, Server Action, Route Handler.
 * Return null kalau tidak ada session valid.
 */
export async function getStudentSession(): Promise<StudentSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("verify_student_session", {
      p_token: token,
    });

    if (error || !data || !data[0]) return null;

    return data[0] as StudentSession;
  } catch {
    return null;
  }
}

/**
 * Baca token mentah dari cookie (untuk RPC yang butuh p_token,
 * mis. student_list_materials / student_get_material).
 * Return null kalau tidak ada cookie.
 */
export async function getStudentToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Set cookie session siswa.
 * HANYA bisa dipanggil di Server Action / Route Handler.
 */
export async function createStudentSession(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Hapus session siswa:
 * 1. Panggil RPC student_logout (hapus row di DB)
 * 2. Hapus cookie
 * HANYA bisa dipanggil di Server Action / Route Handler.
 */
export async function destroyStudentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    try {
      const supabase = await createClient();
      await supabase.rpc("student_logout", { p_token: token });
    } catch {
      // ignore — cookie tetap akan dihapus
    }
  }

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

/**
 * Wrapper: kalau tidak ada session → redirect ke /student/login.
 * Return session valid (non-null).
 * Dipakai di halaman yang butuh login siswa.
 */
export async function requireStudent(): Promise<StudentSession> {
  const session = await getStudentSession();

  if (!session) {
    redirect("/student/login");
  }

  return session;
}