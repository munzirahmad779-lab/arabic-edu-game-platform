"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActiveRoomStore } from "@/lib/game-engine/room-store";

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

  // Auto-detect if this is a Projector Hotseat / Remote session
  const { isProjectorRoomActive } = await import(
    "@/lib/game-engine/projector-controller-store"
  );
  if (code === "HOTSEAT" || isProjectorRoomActive(code)) {
    redirect(`/controller?room=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`);
  }

  const { data, error } = await supabase.rpc("join_room", {
    p_code: code,
    p_name: name,
    p_pin: pin || null,
  });

  if (error || !data?.[0]) {
    const msg = error?.message ?? "";

    console.error("[joinRoom] RPC error:", msg);

    // Second check in case the projector room was initialized during connection
    if (isProjectorRoomActive(code)) {
      redirect(`/controller?room=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`);
    }

    if (msg.includes("ALREADY_JOINED")) {
      try {
        const { data: roomRow } = await supabase
          .from("rooms")
          .select("id, class_id")
          .eq("code", code)
          .maybeSingle();

        if (roomRow) {
          let partRow: { id: string; join_token: string } | null = null;

          // 1. Check if user is logged in with student session
          const { getStudentSession } = await import("@/lib/student-auth");
          const studentSession = await getStudentSession();
          if (studentSession?.student_id) {
            const { data } = await supabase
              .from("room_participants")
              .select("id, join_token")
              .eq("room_id", roomRow.id)
              .eq("student_id", studentSession.student_id)
              .maybeSingle();
            partRow = data;
          }

          // 2. Look up by student name in class
          if (!partRow && roomRow.class_id) {
            const { data: sMatch } = await supabase
              .from("students")
              .select("id")
              .eq("class_id", roomRow.class_id)
              .ilike("name", name)
              .maybeSingle();

            if (sMatch?.id) {
              const { data } = await supabase
                .from("room_participants")
                .select("id, join_token")
                .eq("room_id", roomRow.id)
                .eq("student_id", sMatch.id)
                .maybeSingle();
              partRow = data;
            }
          }

          // 3. Look up by guest_name
          if (!partRow) {
            const { data } = await supabase
              .from("room_participants")
              .select("id, join_token")
              .eq("room_id", roomRow.id)
              .ilike("guest_name", name)
              .maybeSingle();
            partRow = data;
          }

          if (partRow?.join_token) {
            ActiveRoomStore.registerParticipant({
              roomId: roomRow.id,
              joinToken: partRow.join_token,
              participantId: partRow.id,
              name,
            });
            redirect(`/join/room?token=${encodeURIComponent(partRow.join_token)}`);
          }
        }
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err;
      }
    }

    if (msg.includes("PIN_REQUIRED")) {
      redirect(`/join?error=pin_required&code=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`);
    }

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

  const row = data?.[0];
  if (row) {
    ActiveRoomStore.registerParticipant({
      roomId: row.room_id,
      joinToken: row.join_token,
      participantId: row.participant_id,
      name: row.participant_name || name,
    });
    redirect(`/join/room?token=${encodeURIComponent(row.join_token)}`);
  }
  redirect(`/join?error=generic`);
}