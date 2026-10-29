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

    // Pemulihan gabung ulang lewat SECURITY DEFINER RPC (migrasi 0068).
    // Blok lama membaca/menulis tabel rooms, students, dan room_participants
    // secara langsung sebagai anon; RLS (migrasi 0002) hanya memberi policy
    // kepada authenticated pemilik ruangan, sehingga blok itu tidak pernah
    // menghasilkan apa pun di produksi — dan cabang "auto-register"nya bahkan
    // akan melewati pemeriksaan PIN room kelas bila suatu saat RLS longgar.
    if (msg.includes("ALREADY_JOINED") || msg.includes("ROOM_NOT_OPEN")) {
      try {
        const { data: recData, error: recError } = await supabase.rpc(
          "reconnect_room_participant",
          { p_code: code, p_name: name },
        );
        const rec = !recError && recData && recData.length > 0 ? recData[0] : null;

        if (rec && rec.room_state !== "ended" && rec.join_token && rec.participant_id) {
          ActiveRoomStore.registerParticipant({
            roomId: rec.room_id,
            joinToken: rec.join_token,
            participantId: rec.participant_id,
            name: rec.participant_name || name,
          });
          redirect(`/join/room?token=${encodeURIComponent(rec.join_token)}`);
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