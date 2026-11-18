import { createSign } from "node:crypto";

/**
 * Unggah berkas ke Google Drive memakai akun layanan (service account).
 *
 * Dipakai fitur Post Tes VN: rekaman suara jawaban siswa disimpan di
 * Google Drive, bukan di Supabase Storage atau Cloudflare, supaya
 * kuota penyimpanan kedua platform itu tidak terbebani berkas audio.
 * Basis data hanya menyimpan ID berkas dan tautannya.
 *
 * Kredensial dibaca dari env server (tidak pernah dikirim ke klien):
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON  isi JSON kunci akun layanan
 *   GOOGLE_DRIVE_FOLDER_ID             ID folder tujuan di Drive
 * Bila env belum terpasang, driveConfigured() mengembalikan false dan
 * pemanggil wajib membalas galat yang jelas (fitur tertidur, bukan
 * crash).
 *
 * Token akses diperoleh dari JWT akun layanan yang ditandatangani
 * RS256 memakai node:crypto bawaan, lalu ditukar di endpoint token
 * Google. Tidak ada dependensi tambahan (repo tidak memasang jose
 * atau googleapis).
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

let tokenCache: { token: string; expiresAtMs: number } | null = null;

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      // Kunci yang ditempel lewat env kadang menyimpan baris baru
      // sebagai urutan dua karakter "\n"; kembalikan ke baris baru asli.
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

export function driveFolderId(): string | null {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  return id && id.trim().length > 0 ? id.trim() : null;
}

export function driveConfigured(): boolean {
  return readServiceAccount() !== null && driveFolderId() !== null;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signServiceAccountJwt(account: ServiceAccount): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(account.private_key));
  return `${unsigned}.${signature}`;
}

async function getDriveAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 30_000) {
    return tokenCache.token;
  }
  const account = readServiceAccount();
  if (!account) {
    throw new Error("DRIVE_NOT_CONFIGURED");
  }
  const assertion = signServiceAccountJwt(account);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`DRIVE_TOKEN_FAILED_${res.status}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new Error("DRIVE_TOKEN_EMPTY");
  }
  tokenCache = {
    token: data.access_token,
    expiresAtMs: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
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

/**
 * Unggah satu berkas audio ke folder Drive tujuan, lalu atur izinnya
 * menjadi pembaca bagi siapa pun yang memiliki tautan, supaya guru
 * bisa memutar rekaman dari halaman rincian tanpa masuk akun Drive.
 */
export async function uploadAudioToDrive(params: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<DriveUploadResult> {
  const folderId = driveFolderId();
  if (!folderId) {
    throw new Error("DRIVE_NOT_CONFIGURED");
  }
  const accessToken = await getDriveAccessToken();

  const boundary = `magguru-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const metadata = JSON.stringify({
    name: sanitizeDriveFileName(params.fileName),
    parents: [folderId],
    mimeType: params.mimeType,
  });
  const head = Buffer.from(
    `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${params.mimeType}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([
    head,
    Buffer.from(params.bytes),
    tail,
  ]);

  const uploadRes = await fetch(
    `${UPLOAD_URL}?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!uploadRes.ok) {
    throw new Error(`DRIVE_UPLOAD_FAILED_${uploadRes.status}`);
  }
  const uploaded = (await uploadRes.json()) as {
    id?: string;
    webViewLink?: string;
  };
  if (!uploaded.id) {
    throw new Error("DRIVE_UPLOAD_NO_ID");
  }
  const fileId = uploaded.id;

  const permRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
  if (!permRes.ok) {
    throw new Error(`DRIVE_PERMISSION_FAILED_${permRes.status}`);
  }

  return {
    fileId,
    link:
      uploaded.webViewLink ??
      `https://drive.google.com/file/d/${fileId}/view`,
  };
}
