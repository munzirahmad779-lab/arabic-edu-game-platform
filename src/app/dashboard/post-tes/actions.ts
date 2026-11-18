"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Buka atau tutup Post Tes VN untuk semua siswa. Keadaan disimpan di
 * tabel post_test_settings lewat RPC teacher_set_post_test_open
 * (migrasi 0126). Selama tertutup, halaman siswa hanya menampilkan
 * pemberitahuan dan RPC simpan jawaban menolak.
 */
export async function setPostTestOpen(
  open: boolean,
): Promise<{ ok: boolean; isOpen: boolean | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, isOpen: null };

  const { data, error } = await supabase.rpc("teacher_set_post_test_open", {
    p_open: open,
  });

  if (error) {
    console.error("[setPostTestOpen]", error);
    return { ok: false, isOpen: null };
  }

  revalidatePath("/dashboard/post-tes");
  revalidatePath("/student/practice");
  return { ok: true, isOpen: data === true };
}
