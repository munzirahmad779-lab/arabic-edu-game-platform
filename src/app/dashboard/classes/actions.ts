"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MAX_CLASS_NAME_LENGTH = 100;

export async function createClass(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (!name || name.length > MAX_CLASS_NAME_LENGTH) {
    redirect("/dashboard/classes?error=invalid_name");
  }

  const { error } = await supabase.from("classes").insert({
    teacher_id: user.id,
    name,
  });

  if (error) {
    // PostgreSQL unique violation for (teacher_id, name).
    if (error.code === "23505") {
      redirect("/dashboard/classes?error=duplicate");
    }

    redirect("/dashboard/classes?error=create_failed");
  }

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard");
  redirect("/dashboard/classes");
}
