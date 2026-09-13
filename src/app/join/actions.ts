"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinRoom(formData: FormData) {
  const supabase = await createClient();
  const code = typeof formData.get("code") === "string" ? String(formData.get("code")).trim().toUpperCase() : "";
  const name = typeof formData.get("name") === "string" ? String(formData.get("name")).trim() : "";
  const pin = typeof formData.get("pin") === "string" ? String(formData.get("pin")).trim() : "";
  if (!code || !name) redirect(`/join?error=${encodeURIComponent("بيانات الانضمام غير مكتملة.")}`);
  const { data, error } = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any).rpc("join_room", { p_code: code, p_name: name, p_pin: pin || null });
  if (error || !data?.[0]) {
    const message = error?.message.includes("ROOM_NOT_FOUND") ? "رمز الغرفة غير صحيح."
      : error?.message.includes("ROOM_NOT_OPEN") ? "هذه الغرفة لم تعد مفتوحة للانضمام."
      : error?.message.includes("ROOM_FULL") ? "الغرفة ممتلئة."
      : error?.message.includes("INVALID_PIN") ? "رمز PIN غير صحيح."
      : error?.message.includes("STUDENT_NOT_FOUND") ? "لم يتم العثور على هذا الطالب في الفصل."
      : error?.message.includes("ALREADY_JOINED") ? "هذا الطالب موجود بالفعل في الغرفة."
      : "تعذر الانضمام إلى الغرفة.";
    redirect(`/join?error=${encodeURIComponent(message)}`);
  }
  redirect(`/join/room?token=${encodeURIComponent(data[0].join_token)}`);
}
