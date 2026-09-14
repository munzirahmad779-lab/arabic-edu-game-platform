"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const MAX_TITLE_LENGTH = 200;
const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB
const MAX_PDF_BYTES = 1024 * 1024; // 1 MB
const MEDIA_BUCKET = "question-media";

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

function getFileExtension(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return "bin";
}

async function uploadMaterialMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  file: File,
  kind: "image" | "pdf",
): Promise<{ path: string | null; error: string | null }> {
  if (file.size === 0) return { path: null, error: null };

  if (kind === "image") {
    if (!file.type.startsWith("image/")) {
      return { path: null, error: "image_invalid_type" };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { path: null, error: "image_too_large" };
    }
  } else {
    if (file.type !== "application/pdf") {
      return { path: null, error: "pdf_invalid_type" };
    }
    if (file.size > MAX_PDF_BYTES) {
      return { path: null, error: "pdf_too_large" };
    }
  }

  const ext = getFileExtension(file);
  const random = Math.random().toString(36).slice(2, 10);
  const path = `materials/${classId}/${kind}-${Date.now()}-${random}.${ext}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (error) {
    console.error("[uploadMaterialMedia]", error);
    return { path: null, error: `upload_failed:${error.message}` };
  }

  return { path, error: null };
}

async function deleteMaterialMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
) {
  if (!path) return;
  try {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  } catch {
    // ignore
  }
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
  const imageFile = formData.get("image_file");
  const pdfFile = formData.get("pdf_file");

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

  let imagePath: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    const result = await uploadMaterialMedia(
      supabase,
      classId,
      imageFile,
      "image",
    );
    if (result.error) {
      redirect(
        `/dashboard/classes/${classId}?material_error=${encodeURIComponent(result.error)}`,
      );
    }
    imagePath = result.path;
  }

  let pdfPath: string | null = null;
  if (pdfFile instanceof File && pdfFile.size > 0) {
    const result = await uploadMaterialMedia(supabase, classId, pdfFile, "pdf");
    if (result.error) {
      // hapus gambar yang sudah terlanjur di-upload supaya tidak ada sampah
      await deleteMaterialMedia(supabase, imagePath);
      redirect(
        `/dashboard/classes/${classId}?material_error=${encodeURIComponent(result.error)}`,
      );
    }
    pdfPath = result.path;
  }

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
    image_path: imagePath,
    pdf_path: pdfPath,
    position: nextPosition,
    is_published: false,
  });

  if (error) {
    console.error("[createMaterial]", error);
    await deleteMaterialMedia(supabase, imagePath);
    await deleteMaterialMedia(supabase, pdfPath);
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
  const removeImage = normalizeText(formData.get("remove_image")) === "1";
  const removePdf = normalizeText(formData.get("remove_pdf")) === "1";
  const imageFile = formData.get("image_file");
  const pdfFile = formData.get("pdf_file");

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

  const { data: current } = await supabase
    .from("class_materials")
    .select("image_path, pdf_path")
    .eq("id", materialId)
    .eq("class_id", classId)
    .maybeSingle();

  let nextImagePath: string | null = current?.image_path ?? null;
  let nextPdfPath: string | null = current?.pdf_path ?? null;

  // Handle gambar
  if (imageFile instanceof File && imageFile.size > 0) {
    const result = await uploadMaterialMedia(
      supabase,
      classId,
      imageFile,
      "image",
    );
    if (result.error) {
      redirect(
        `/dashboard/classes/${classId}?material_error=${encodeURIComponent(result.error)}`,
      );
    }
    await deleteMaterialMedia(supabase, nextImagePath);
    nextImagePath = result.path;
  } else if (removeImage) {
    await deleteMaterialMedia(supabase, nextImagePath);
    nextImagePath = null;
  }

  // Handle PDF
  if (pdfFile instanceof File && pdfFile.size > 0) {
    const result = await uploadMaterialMedia(supabase, classId, pdfFile, "pdf");
    if (result.error) {
      redirect(
        `/dashboard/classes/${classId}?material_error=${encodeURIComponent(result.error)}`,
      );
    }
    await deleteMaterialMedia(supabase, nextPdfPath);
    nextPdfPath = result.path;
  } else if (removePdf) {
    await deleteMaterialMedia(supabase, nextPdfPath);
    nextPdfPath = null;
  }

  const { error } = await supabase
    .from("class_materials")
    .update({
      title,
      content_json: parsedContent,
      youtube_url: youtubeUrl || null,
      image_path: nextImagePath,
      pdf_path: nextPdfPath,
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

  const { data: current } = await supabase
    .from("class_materials")
    .select("image_path, pdf_path")
    .eq("id", materialId)
    .eq("class_id", classId)
    .maybeSingle();

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

  await deleteMaterialMedia(supabase, current?.image_path ?? null);
  await deleteMaterialMedia(supabase, current?.pdf_path ?? null);

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