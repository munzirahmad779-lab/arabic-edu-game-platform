import {
  createClient as createJsClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Klien Supabase service-role. HANYA untuk kode server (route handler /
 * server action); jangan pernah diimpor dari komponen klien.
 *
 * Klien ini melewati RLS dan grant tabel, jadi ia bukan pengganti
 * pemeriksaan wewenang: setiap route yang memakainya WAJIB memeriksa
 * dulu siapa pemanggilnya (sesi guru Supabase atau sesi siswa) dan
 * bahwa pemanggil itu berhak atas baris yang disentuh. Di route
 * /api/grade-essay, klien ini dipakai untuk membaca submission dan
 * menulis skor lewat RPC student_set_ai_grade, yang gerbang
 * service_role-nya memang disediakan migrasi 0084 untuk jalur server
 * tepercaya.
 *
 * Melempar Error bila env belum dikonfigurasi, supaya kegagalan
 * terdengar di log server dan terlihat pemanggil sebagai galat 500,
 * bukan diam-diam berhenti seperti jalur lama.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "[supabase/service] NEXT_PUBLIC_SUPABASE_URL atau " +
        "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.",
    );
  }

  return createJsClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
