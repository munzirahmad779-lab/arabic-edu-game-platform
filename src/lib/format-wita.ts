// Zona waktu tampilan seluruh dasbor: WITA (Asia/Makassar, UTC+8),
// mengikuti lokasi sekolah pengguna platform. Modul ini sebelumnya
// memakai UTC+7 (WIB) sehingga jam sesi pada laporan tampil bergeser
// satu jam lebih awal dari waktu setempat; penggantian nama dari
// format-wib menjadi format-wita menandai koreksi itu.
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function toWitaDate(v: string | null): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    const wita = new Date(d.getTime() + WITA_OFFSET_MS);
    return `${wita.getUTCFullYear()}-${String(wita.getUTCMonth() + 1).padStart(2, "0")}-${String(wita.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export function toWitaDateTime(v: string | null): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    const wita = new Date(d.getTime() + WITA_OFFSET_MS);
    const y = wita.getUTCFullYear();
    const m = String(wita.getUTCMonth() + 1).padStart(2, "0");
    const day = String(wita.getUTCDate()).padStart(2, "0");
    const h = String(wita.getUTCHours()).padStart(2, "0");
    const min = String(wita.getUTCMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return "—";
  }
}

export function toWitaTime(v: string | null): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    const wita = new Date(d.getTime() + WITA_OFFSET_MS);
    const h = String(wita.getUTCHours()).padStart(2, "0");
    const min = String(wita.getUTCMinutes()).padStart(2, "0");
    return `${h}:${min}`;
  } catch {
    return "—";
  }
}

export function todayWita(): string {
  const now = new Date();
  const wita = new Date(now.getTime() + WITA_OFFSET_MS);
  return `${wita.getUTCFullYear()}-${String(wita.getUTCMonth() + 1).padStart(2, "0")}-${String(wita.getUTCDate()).padStart(2, "0")}`;
}

export function yesterdayWita(): string {
  const now = new Date();
  const wita = new Date(now.getTime() + WITA_OFFSET_MS - 24 * 60 * 60 * 1000);
  return `${wita.getUTCFullYear()}-${String(wita.getUTCMonth() + 1).padStart(2, "0")}-${String(wita.getUTCDate()).padStart(2, "0")}`;
}