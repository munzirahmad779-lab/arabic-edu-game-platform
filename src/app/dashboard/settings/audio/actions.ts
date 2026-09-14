"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MEDIA_BUCKET = "question-media";
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const VALID_PAGES = ["dashboard", "login", "student", "game", "final"] as const;

function readString(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function readInt(fd: FormData, key: string, min: number, max: number) {
  const n = Number(readString(fd, key));
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < min || r > max) return null;
  return r;
}

function readPages(fd: FormData): string[] {
  const all = fd.getAll("pages");
  return all
    .filter((v): v is string => typeof v === "string")
    .filter((v) => (VALID_PAGES as readonly string[]).includes(v));
}

function errPath(code: string): never {
  redirect(`/dashboard/settings/audio?error=${code}`);
}

async function uploadAudio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  file: File,
): Promise<{ path: string; url: string } | { error: string }> {
  if (!file.type.startsWith("audio/")) return { error: "invalid_type" };
  if (file.size > MAX_AUDIO_BYTES) return { error: "too_large" };

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const random = Math.random().toString(36).slice(2, 10);
  const path = `backdrops/${userId}/${Date.now()}-${random}.${ext}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (error) return { error: `upload_failed:${error.message}` };

  const url = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data
    .publicUrl;
  return { path, url };
}

export async function createAudioTrack(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = readString(formData, "name");
  const volume = readInt(formData, "volume", 0, 100);
  const pages = readPages(formData);
  const file = formData.get("audio_file");

  if (!name || name.length > 100) errPath("invalid_name");
  if (volume === null) errPath("invalid_volume");
  if (pages.length === 0) errPath("no_pages");
  if (!(file instanceof File) || file.size === 0) errPath("no_file");

  const upload = await uploadAudio(supabase, user.id, file);
  if ("error" in upload) errPath(upload.error);

  const { error } = await supabase.from("teacher_audio_tracks").insert({
    teacher_id: user.id,
    name,
    audio_path: upload.path,
    audio_url: upload.url,
    volume,
    pages,
    enabled: true,
  });

  if (error) {
    try {
      await supabase.storage.from(MEDIA_BUCKET).remove([upload.path]);
    } catch {
      // ignore
    }
    errPath(`insert_failed:${error.message}`);
  }

  revalidatePath("/dashboard/settings/audio");
  redirect("/dashboard/settings/audio?saved=1");
}

export async function updateAudioTrack(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = readString(formData, "track_id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) errPath("invalid_id");

  const name = readString(formData, "name");
  const volume = readInt(formData, "volume", 0, 100);
  const pages = readPages(formData);
  const file = formData.get("audio_file");

  if (!name || name.length > 100) errPath("invalid_name");
  if (volume === null) errPath("invalid_volume");
  if (pages.length === 0) errPath("no_pages");

  const { data: current } = await supabase
    .from("teacher_audio_tracks")
    .select("audio_path, audio_url")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!current) errPath("not_found");

  let nextPath = current.audio_path;
  let nextUrl = current.audio_url;

  if (file instanceof File && file.size > 0) {
    const upload = await uploadAudio(supabase, user.id, file);
    if ("error" in upload) errPath(upload.error);

    if (current.audio_path) {
      try {
        await supabase.storage.from(MEDIA_BUCKET).remove([current.audio_path]);
      } catch {
        // ignore
      }
    }

    nextPath = upload.path;
    nextUrl = upload.url;
  }

  const { error } = await supabase
    .from("teacher_audio_tracks")
    .update({
      name,
      volume,
      pages,
      audio_path: nextPath,
      audio_url: nextUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) errPath(`update_failed:${error.message}`);

  revalidatePath("/dashboard/settings/audio");
  redirect("/dashboard/settings/audio?updated=1");
}

export async function deleteAudioTrack(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = readString(formData, "track_id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) errPath("invalid_id");

  const { data: current } = await supabase
    .from("teacher_audio_tracks")
    .select("audio_path")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("teacher_audio_tracks")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) errPath(`delete_failed:${error.message}`);

  if (current?.audio_path) {
    try {
      await supabase.storage.from(MEDIA_BUCKET).remove([current.audio_path]);
    } catch {
      // ignore
    }
  }

  revalidatePath("/dashboard/settings/audio");
  redirect("/dashboard/settings/audio?deleted=1");
}

export async function toggleAudioTrack(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = readString(formData, "track_id");
  const currentEnabled = readString(formData, "current_enabled") === "true";

  if (!/^[0-9a-f-]{36}$/i.test(id)) errPath("invalid_id");

  const { error } = await supabase
    .from("teacher_audio_tracks")
    .update({
      enabled: !currentEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) errPath(`toggle_failed:${error.message}`);

  revalidatePath("/dashboard/settings/audio");
  redirect("/dashboard/settings/audio");
}