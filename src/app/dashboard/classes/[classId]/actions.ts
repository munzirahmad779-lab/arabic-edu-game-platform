"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const MAX_TITLE_LENGTH = 200;

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureTeacherClass(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

export async function createMaterial(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const classId = normalizeText(formData.get("class_id"));
  const title = normalizeText(formData.get("title"));
  const contentJson = normalizeText(formData.get("content_json"));
  const youtubeUrl = normalizeText(formData.get("youtube_url"));

  if (!classId) redirect("/dashboard/classes");
  if (!title || title.length > MAX_TITLE_LENGTH) {
    redirect(`/dashboard/classes/${classId}?material_error=invalid_title`);
  }

  const owns = await ensureTeacherClass(supabase, classId, user.id);
  if (!owns) redirect("/dashboard/classes?error=not_found");

  let parsedContent: Json | null = null;
  if (contentJson) {
    try {
      parsedContent = JSON.parse(contentJson) as Json;
    } catch {
      parsedContent = null;
    }
  }

  // Cari position berikutnya
  const { data: lastRow } = await supabase
    .from("class_materials")
    .select("position")
    .eq("class_id", classId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (lastRow?.position ?? -1) + 1;

  const { error } = await supabase.from("class_materials").insert({
    class_id: classId,
    title,
    content_json: parsedContent,
    youtube_url: youtubeUrl || null,
    position: nextPosition,
    is_published: false,
  });

  if (error) {
    console.error("[createMaterial]", error);
    redirect(
      `/dashboard/classes/${classId}?material_error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}?material_created=1`);
}

export async function updateMaterial(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const materialId = normalizeText(formData.get("material_id"));
  const classId = normalizeText(formData.get("class_id"));
  const title = normalizeText(formData.get("title"));
  const contentJson = normalizeText(formData.get("content_json"));
  const youtubeUrl = normalizeText(formData.get("youtube_url"));

  if (!materialId || !classId) redirect("/dashboard/classes");
  if (!title || title.length > MAX_TITLE_LENGTH) {
    redirect(`/dashboard/classes/${classId}?material_error=invalid_title`);
  }

  const owns = await ensureTeacherClass(supabase, classId, user.id);
  if (!owns) redirect("/dashboard/classes?error=not_found");

  let parsedContent: Json | null = null;
  if (contentJson) {
    try {
      parsedContent = JSON.parse(contentJson) as Json;
    } catch {
      parsedContent = null;
    }
  }

  const { error } = await supabase
    .from("class_materials")
    .update({
      title,
      content_json: parsedContent,
      youtube_url: youtubeUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", materialId)
    .eq("class_id", classId);

  if (error) {
    console.error("[updateMaterial]", error);
    redirect(
      `/dashboard/classes/${classId}?material_error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}?material_updated=1`);
}

export async function deleteMaterial(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const materialId = normalizeText(formData.get("material_id"));
  const classId = normalizeText(formData.get("class_id"));

  if (!materialId || !classId) redirect("/dashboard/classes");

  const owns = await ensureTeacherClass(supabase, classId, user.id);
  if (!owns) redirect("/dashboard/classes?error=not_found");

  const { error } = await supabase
    .from("class_materials")
    .delete()
    .eq("id", materialId)
    .eq("class_id", classId);

  if (error) {
    console.error("[deleteMaterial]", error);
    redirect(
      `/dashboard/classes/${classId}?material_error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}?material_deleted=1`);
}

export async function togglePublish(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const materialId = normalizeText(formData.get("material_id"));
  const classId = normalizeText(formData.get("class_id"));
  const current = normalizeText(formData.get("current_published"));

  if (!materialId || !classId) redirect("/dashboard/classes");

  const owns = await ensureTeacherClass(supabase, classId, user.id);
  if (!owns) redirect("/dashboard/classes?error=not_found");

  const nextPublished = current !== "true";

  const { error } = await supabase
    .from("class_materials")
    .update({ is_published: nextPublished })
    .eq("id", materialId)
    .eq("class_id", classId);

  if (error) {
    console.error("[togglePublish]", error);
    redirect(
      `/dashboard/classes/${classId}?material_error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}`);
}

export async function moveMaterial(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const materialId = normalizeText(formData.get("material_id"));
  const classId = normalizeText(formData.get("class_id"));
  const direction = normalizeText(formData.get("direction"));

  if (!materialId || !classId || !["up", "down"].includes(direction)) {
    redirect("/dashboard/classes");
  }

  const owns = await ensureTeacherClass(supabase, classId, user.id);
  if (!owns) redirect("/dashboard/classes?error=not_found");

  const { data: rows } = await supabase
    .from("class_materials")
    .select("id, position")
    .eq("class_id", classId)
    .order("position", { ascending: true });

  if (!rows || rows.length < 2) {
    redirect(`/dashboard/classes/${classId}`);
  }

  const currentIndex = rows.findIndex((r) => r.id === materialId);
  if (currentIndex === -1) redirect(`/dashboard/classes/${classId}`);

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= rows.length) {
    redirect(`/dashboard/classes/${classId}`);
  }

  const currentRow = rows[currentIndex];
  const targetRow = rows[targetIndex];

  // Tukar position
  await supabase
    .from("class_materials")
    .update({ position: targetRow.position })
    .eq("id", currentRow.id);

  await supabase
    .from("class_materials")
    .update({ position: currentRow.position })
    .eq("id", targetRow.id);

  revalidatePath(`/dashboard/classes/${classId}`);
  redirect(`/dashboard/classes/${classId}`);
}