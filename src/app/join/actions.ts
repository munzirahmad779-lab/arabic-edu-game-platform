"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinRoom(formData: FormData) {
  const supabase = await createClient();

  const code =
    typeof formData.get("code") === "string"
      ? String(formData.get("code")).trim().toUpperCase()
      : "";
  const name =
    typeof formData.get("name") === "string"
      ? String(formData.get("name")).trim()
      : "";
  const pin =
    typeof formData.get("pin") === "string"
      ? String(formData.get("pin")).trim()
      : "";

  if (!code || !name) {
    redirect(`/join?error=${encodeURIComponent("incomplete")}`);
  }

  const { data, error } = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any).rpc("join_room", {
    p_code: code,
    p_name: name,
    p_pin: pin || null,
  });

  if (error || !data?.[0]) {
    const msg = error?.message ?? "";

    console.error("[joinRoom] RPC error:", msg);

    const codeKey =
      msg.includes("ROOM_NOT_FOUND") ? "room_not_found"
      : msg.includes("ROOM_NOT_OPEN") ? "room_not_open"
      : msg.includes("ROOM_FULL") ? "room_full"
      : msg.includes("PIN_REQUIRED") ? "pin_required"
      : msg.includes("INVALID_PIN") ? "invalid_pin"
      : msg.includes("STUDENT_NOT_FOUND") ? "student_not_found"
      : msg.includes("ALREADY_JOINED") ? "already_joined"
      : msg.includes("INVALID_NAME") ? "invalid_name"
      : msg.includes("INVALID_ROOM_CODE") ? "room_not_found"
      : "generic";

    redirect(
      `/join?error=${encodeURIComponent(codeKey)}&debug=${encodeURIComponent(msg.slice(0, 120))}`,
    );
  }

  redirect(`/join/room?token=${encodeURIComponent(data[0].join_token)}`);
}