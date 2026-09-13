"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createStudentSession,
  destroyStudentSession,
} from "@/lib/student-auth";

export async function loginStudent(formData: FormData) {
  const rawName = formData.get("name");
  const rawPin = formData.get("pin");

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const pin = typeof rawPin === "string" ? rawPin.trim() : "";

  if (!name || !/^\d{4,6}$/.test(pin)) {
    redirect("/student/login?error=invalid_length");
  }

  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  let token: string | null = null;
  let errorCode: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("student_login", {
      p_name: name,
      p_pin: pin,
      p_ip: ip,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("TOO_MANY_ATTEMPTS")) {
        errorCode = "too_many";
      } else {
        errorCode = "invalid";
      }
    } else if (data && data[0] && data[0].token) {
      token = data[0].token;
    } else {
      errorCode = "invalid";
    }
  } catch {
    errorCode = "network";
  }

  if (errorCode) {
    redirect(`/student/login?error=${errorCode}`);
  }

  if (!token) {
    redirect("/student/login?error=invalid");
  }

  await createStudentSession(token);
  redirect("/student");
}

export async function logoutStudent() {
  await destroyStudentSession();
  redirect("/student/login");
}