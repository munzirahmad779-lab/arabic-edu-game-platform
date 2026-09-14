"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MEDIA_BUCKET = "question-media";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

function readString(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function readBool(fd: FormData, key: string) {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

function readInt(fd: FormData, key: string, min: number, max: number) {
  const raw = readString(fd, key);
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

export async function saveAudioSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const enabled = readBool(formData, "enabled");
  const volume = readInt(formData, "volume", 0, 100);
  const playOnDashboard = readBool(formData, "play_on_dashboard");
  const playOnLogin = readBool(formData, "play_on_login");
  const playOnStudent = readBool(formData, "play_on_student");
  const playOnGame = readBool(formData, "play_on_game");
  const playOnFinal = readBool(formData, "play_on_final");

  if (volume === null) {
    redirect("/dashboard/settings/audio?error=invalid_volume");
  }

  // Handle existing settings
  const { data: current } = await supabase
    .from("teacher_audio_settings")
    .select("audio_path, audio_url")
    .eq("teacher_id", user.id)
    .maybeSingle();

  let nextPath = current?.audio_path ?? null;
  let nextUrl = current?.audio_url ?? null;

  // Handle upload file baru
  const file = formData.get("audio_file");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("audio/")) {
      redirect("/dashboard/settings/audio?error=invalid_type");
    }
    if (file.size > MAX_AUDIO_BYTES) {
      redirect("/dashboard/settings/audio?error=too_large");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const random = Math.random().toString(36).slice(2, 10);
    const path = `backdrops/${user.id}/bg-${Date.now()}-${random}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadErr) {
      redirect(
        `/dashboard/settings/audio?error=${encodeURIComponent(uploadErr.message)}`,
      );
    }

    // Hapus file lama
    if (current?.audio_path) {
      try {
        await supabase.storage.from(MEDIA_BUCKET).remove([current.audio_path]);
      } catch {
        // ignore
      }
    }

    nextPath = path;
    nextUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data
      .publicUrl;
  }

  // Handle hapus audio
  const remove = readBool(formData, "remove_audio");
  if (remove && nextPath) {
    try {
      await supabase.storage.from(MEDIA_BUCKET).remove([nextPath]);
    } catch {
      // ignore
    }
    nextPath = null;
    nextUrl = null;
  }

  const payload = {
    teacher_id: user.id,
    enabled,
    audio_path: nextPath,
    audio_url: nextUrl,
    volume,
    play_on_dashboard: playOnDashboard,
    play_on_login: playOnLogin,
    play_on_student: playOnStudent,
    play_on_game: playOnGame,
    play_on_final: playOnFinal,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("teacher_audio_settings")
    .upsert(payload, { onConflict: "teacher_id" });

  if (error) {
    redirect(
      `/dashboard/settings/audio?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/dashboard/settings/audio");
  revalidatePath("/dashboard");
  redirect("/dashboard/settings/audio?saved=1");
}