import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-auth";
import {
  sanitizeDriveFileName,
  uploadAudioToDrive,
  uploadConfigured,
} from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unggah satu rekaman jawaban Post Tes VN ke Google Drive.
 *
 * Sesi siswa diverifikasi dari cookie sesi yang sama dengan halaman
 * siswa (student_session). Tanpa sesi valid: 401. Berkas diterima
 * sebagai multipart form-data: field "audio" (berkas rekaman) dan
 * "urutan" (nomor soal, untuk nama berkas). Nama berkas di Drive:
 * nama siswa + nomor soal + timestamp.
 *
 * Bila env jembatan unggah belum terpasang (POST_TEST_UPLOAD_URL
 * atau POST_TEST_UPLOAD_SECRET kosong), rute membalas 503 dengan
 * pesan yang jelas: fitur tertidur, bukan crash.
 *
 * Sukses: 200 { file_id, link }. Klien lalu menyimpan hasilnya lewat
 * RPC student_save_post_test_answer (server action di halaman siswa).
 */

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export async function POST(request: Request) {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sesi siswa tidak ditemukan. Silakan masuk lagi." },
      { status: 401 },
    );
  }

  if (!uploadConfigured()) {
    return NextResponse.json(
      {
        error: "UPLOAD_NOT_CONFIGURED",
        message:
          "Penyimpanan rekaman belum disiapkan guru. Coba lagi nanti atau hubungi gurumu.",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "BAD_FORM", message: "Data unggahan tidak terbaca." },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  const urutanRaw = form.get("urutan");
  const urutan =
    typeof urutanRaw === "string" ? Number.parseInt(urutanRaw, 10) : NaN;

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { error: "NO_AUDIO", message: "Berkas rekaman tidak ditemukan." },
      { status: 400 },
    );
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      {
        error: "AUDIO_TOO_LARGE",
        message: "Rekaman terlalu besar. Rekam ulang jawaban yang lebih singkat.",
      },
      { status: 413 },
    );
  }
  if (!Number.isFinite(urutan) || urutan < 1) {
    return NextResponse.json(
      { error: "BAD_URUTAN", message: "Nomor soal tidak valid." },
      { status: 400 },
    );
  }

  const mimeType = audio.type || "audio/webm";
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const fileName = sanitizeDriveFileName(
    `${session.name} - Soal ${urutan} - ${timestamp}.${extensionForMime(mimeType)}`,
  );

  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const result = await uploadAudioToDrive({
      fileName,
      mimeType,
      bytes,
    });
    return NextResponse.json({
      file_id: result.fileId,
      link: result.link,
    });
  } catch (err) {
    console.error("[api/student/post-test/upload]", err);
    return NextResponse.json(
      {
        error: "UPLOAD_FAILED",
        message:
          "Rekaman gagal diunggah. Periksa koneksimu lalu coba kirim lagi.",
      },
      { status: 502 },
    );
  }
}
