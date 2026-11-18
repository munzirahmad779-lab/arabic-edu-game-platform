/**
 * Unggah berkas ke Google Drive lewat jembatan Apps Script Web App.
 *
 * Dipakai fitur Post Tes VN: rekaman suara jawaban siswa disimpan di
 * Google Drive milik akun guru, bukan di Supabase Storage atau
 * Cloudflare, supaya kuota penyimpanan kedua platform itu tidak
 * terbebani berkas audio. Basis data hanya menyimpan ID berkas dan
 * tautannya.
 *
 * Jembatannya adalah Google Apps Script Web App milik akun guru yang
 * menerima POST JSON, menyimpan berkas ke folder Drive tujuan, lalu
 * membalas ID dan tautan berkas. Kredensial dibaca dari env server
 * (tidak pernah dikirim ke klien):
 *   POST_TEST_UPLOAD_URL     URL /exec Web App Apps Script
 *   POST_TEST_UPLOAD_SECRET  token bersama antara Worker dan skrip
 * Bila env belum terpasang, uploadConfigured() mengembalikan false dan
 * pemanggil wajib membalas galat yang jelas (fitur tertidur, bukan
 * crash).
 *
 * Catatan redirect: Web App Apps Script membalas redirect 302 ke
 * script.googleusercontent.com. fetch bawaan Node (undici) mengikuti
 * redirect secara default, tetapi untuk POST ia mengubah metode
 * menjadi GET pada 302. Tanggapan akhir tetap JSON yang sama, jadi
 * kode di bawah cukup membaca body JSON dari respons akhir.
 *
 * Ketahanan: Apps Script bisa lambat atau menolak sesaat, terutama
 * saat banyak siswa menekan Kirim bersamaan (batas eksekusi serentak
 * di sisi Google) atau jaringan bergetar. Karena itu uploadAudioToDrive
 * mencoba sampai 3 kali dengan jeda bertingkat sebelum menyerah.
 * Percobaan ulang aman karena nama berkas memuat cap waktu dan RPC
 * simpan jawaban menimpa baris yang sama, jadi berkas yatim di Drive
 * tidak mengubah data jawaban. Kegagalan konfigurasi (env kosong)
 * TIDAK dicoba ulang: langsung gagal dengan UPLOAD_NOT_CONFIGURED.
 */

export function uploadUrl(): string | null {
  const url = process.env.POST_TEST_UPLOAD_URL;
  return url && url.trim().length > 0 ? url.trim() : null;
}

export function uploadSecret(): string | null {
  const secret = process.env.POST_TEST_UPLOAD_SECRET;
  return secret && secret.trim().length > 0 ? secret.trim() : null;
}

export function uploadConfigured(): boolean {
  return uploadUrl() !== null && uploadSecret() !== null;
}

/**
 * Bersihkan nama berkas Drive dari karakter yang tidak aman
 * (pemisah jalur dan karakter kendali).
 */
export function sanitizeDriveFileName(name: string): string {
  return name
    .replace(/[/\\]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);
}

export type DriveUploadResult = {
  fileId: string;
  link: string;
};

type UploadBridgeResponse = {
  ok?: boolean;
  id?: string;
  url?: string;
  error?: string;
};

const MAKS_PERCOBAAN_UNGGAH = 3;
// Jeda sebelum percobaan ke-2 dan ke-3. Jeda bertingkat memberi
// ruang bagi antrean eksekusi Apps Script yang sedang penuh.
const JEDA_PERCOBAAN_MS = [1000, 3000];

function tunggu(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Satu kali percobaan unggah. Semua kegagalan di sini dianggap bisa
 * sesaat: fetch terlempar (jaringan putus, redirect gagal), status
 * HTTP bukan 2xx (Apps Script membalas halaman galat saat bebannya
 * penuh), body bukan JSON, balasan ok:false, atau balasan sukses
 * tanpa id/url.
 */
async function unggahSatuKali(
  url: string,
  secret: string,
  params: {
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
  },
): Promise<DriveUploadResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: secret,
      filename: sanitizeDriveFileName(params.fileName),
      mime: params.mimeType,
      data: Buffer.from(params.bytes).toString("base64"),
    }),
  });
  if (!res.ok) {
    throw new Error(`UPLOAD_FAILED_${res.status}`);
  }

  const data = (await res.json()) as UploadBridgeResponse;
  if (data.ok !== true) {
    throw new Error(
      `UPLOAD_REJECTED${data.error ? `: ${data.error}` : ""}`,
    );
  }
  if (!data.id || !data.url) {
    throw new Error("UPLOAD_NO_RESULT");
  }

  return { fileId: data.id, link: data.url };
}

/**
 * Unggah satu berkas audio lewat jembatan Apps Script. Isi audio
 * dikirim sebagai base64 di dalam body JSON bersama token bersama,
 * nama berkas, dan tipe MIME. Balasan sukses { ok: true, id, url }
 * dipetakan ke { fileId, link }; url dipakai apa adanya.
 *
 * Kegagalan sesaat dicoba ulang sampai 3 percobaan dengan jeda
 * bertingkat (1 detik, lalu 3 detik); balasan ok:true langsung
 * berhenti. Bila env belum terpasang, langsung gagal dengan
 * UPLOAD_NOT_CONFIGURED tanpa percobaan ulang dan tanpa fetch.
 */
export async function uploadAudioToDrive(params: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<DriveUploadResult> {
  const url = uploadUrl();
  const secret = uploadSecret();
  if (!url || !secret) {
    throw new Error("UPLOAD_NOT_CONFIGURED");
  }

  let galatTerakhir: unknown = null;
  for (let percobaan = 1; percobaan <= MAKS_PERCOBAAN_UNGGAH; percobaan++) {
    try {
      return await unggahSatuKali(url, secret, params);
    } catch (err) {
      galatTerakhir = err;
      if (percobaan < MAKS_PERCOBAAN_UNGGAH) {
        await tunggu(JEDA_PERCOBAAN_MS[percobaan - 1]);
      }
    }
  }

  throw galatTerakhir instanceof Error
    ? galatTerakhir
    : new Error("UPLOAD_FAILED");
}
