"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const VALID_THEMES = [
  "violet",
  "rose",
  "emerald",
  "sky",
  "amber",
  "indigo",
  "slate",
  "teal",
] as const;

export async function updateTeacherTheme(formData: FormData) {
  const raw = formData.get("theme");
  const theme = typeof raw === "string" ? raw.trim() : "";

  if (!VALID_THEMES.includes(theme as (typeof VALID_THEMES)[number])) {
    return { ok: false, message: "ثيم غير صالح" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "غير مسجل" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ theme })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}