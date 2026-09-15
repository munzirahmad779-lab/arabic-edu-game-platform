"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const fullName = getField(formData, "full_name");

  if (!fullName || fullName.length > 100) {
    redirect("/dashboard/account?error=invalid_name");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) {
    redirect(`/dashboard/account?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard");
  redirect("/dashboard/account?saved=1");
}