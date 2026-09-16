"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function readString(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function reorderMaterials(
  classId: string,
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Sesi berakhir." };

  if (!/^[0-9a-f-]{36}$/i.test(classId)) {
    return { ok: false, message: "Kelas tidak valid." };
  }

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, message: "Daftar kosong." };
  }

  // Cek kepemilikan kelas
  const { data: classRow } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!classRow) return { ok: false, message: "Akses ditolak." };

  // Update posisi satu-satu
  for (let i = 0; i < orderedIds.length; i += 1) {
    const id = orderedIds[i];
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;

    const { error } = await supabase
      .from("class_materials")
      .update({ position: i })
      .eq("id", id)
      .eq("class_id", classId);

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  return { ok: true };
}

export async function materialAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const action = readString(formData, "action");
  const materialId = readString(formData, "material_id");
  const classId = readString(formData, "class_id");

  if (!action || !materialId || !classId) {
    redirect("/dashboard/classes");
  }

  // Cek kepemilikan
  const { data: classRow } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!classRow) redirect("/dashboard/classes?error=not_found");

  if (action === "toggle_publish") {
    const current = readString(formData, "current_published") === "true";
    await supabase
      .from("class_materials")
      .update({ is_published: !current })
      .eq("id", materialId)
      .eq("class_id", classId);
  } else if (action === "delete") {
    // Hapus media dulu
    const { data: material } = await supabase
      .from("class_materials")
      .select("image_path, pdf_path")
      .eq("id", materialId)
      .eq("class_id", classId)
      .maybeSingle();

    if (material) {
      const paths: string[] = [];
      if (material.image_path) paths.push(material.image_path);
      if (material.pdf_path) paths.push(material.pdf_path);
      if (paths.length > 0) {
        try {
          await supabase.storage.from("question-media").remove(paths);
        } catch {
          // ignore
        }
      }
    }

    await supabase
      .from("class_materials")
      .delete()
      .eq("id", materialId)
      .eq("class_id", classId);
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}`);
}