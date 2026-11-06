/**
 * Validasi URL embed web game (Wordwall, Quizizz, Educaplay, H5P, dst).
 *
 * Dipakai bersama oleh aksi simpan permainan (server) dan pemain embed
 * (klien), supaya URL yang tidak sah ditolak di pintu masuk dan tidak
 * pernah sampai menjadi bingkai kosong diam-diam di proyektor.
 *
 * Aturan:
 * - wajib URL lengkap yang dapat di-parse;
 * - protokol wajib https: (http:, javascript:, data:, dan skema lain
 *   ditolak);
 * - hostname wajib berbentuk nama host (mengandung titik);
 * - tidak boleh mengandung spasi atau kurung siku: URL disimpan di
 *   dalam token [EMBED:<url>] pada nama permainan, dan kurung siku
 *   akan mematahkan token itu saat dibaca kembali.
 */

export type EmbedUrlRejectReason =
  | "empty"
  | "unsafe_chars"
  | "malformed"
  | "not_https"
  | "invalid_host";

export type EmbedUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: EmbedUrlRejectReason };

export function validateEmbedUrl(raw: unknown): EmbedUrlValidation {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return { ok: false, reason: "empty" };

  if (/\s/.test(trimmed) || trimmed.includes("[") || trimmed.includes("]")) {
    return { ok: false, reason: "unsafe_chars" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "not_https" };
  }

  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { ok: false, reason: "invalid_host" };
  }

  return { ok: true, url: parsed.toString() };
}

export function embedUrlRejectMessage(reason: EmbedUrlRejectReason): string {
  switch (reason) {
    case "empty":
      return "URL embed belum diisi.";
    case "unsafe_chars":
      return "URL embed tidak boleh mengandung spasi atau kurung siku.";
    case "malformed":
      return "Format URL embed tidak dikenal. Tempel URL lengkap dari penyedia web game.";
    case "not_https":
      return "URL embed wajib diawali https:// (URL http:// atau skema lain ditolak).";
    case "invalid_host":
      return "Nama host pada URL embed tidak sah.";
  }
}
