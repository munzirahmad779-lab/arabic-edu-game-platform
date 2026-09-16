const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export function toWibDate(v: string | null): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    const wib = new Date(d.getTime() + WIB_OFFSET_MS);
    return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-${String(wib.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export function toWibDateTime(v: string | null): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    const wib = new Date(d.getTime() + WIB_OFFSET_MS);
    const y = wib.getUTCFullYear();
    const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
    const day = String(wib.getUTCDate()).padStart(2, "0");
    const h = String(wib.getUTCHours()).padStart(2, "0");
    const min = String(wib.getUTCMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return "—";
  }
}

export function toWibTime(v: string | null): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    const wib = new Date(d.getTime() + WIB_OFFSET_MS);
    const h = String(wib.getUTCHours()).padStart(2, "0");
    const min = String(wib.getUTCMinutes()).padStart(2, "0");
    return `${h}:${min}`;
  } catch {
    return "—";
  }
}

export function todayWib(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-${String(wib.getUTCDate()).padStart(2, "0")}`;
}

export function yesterdayWib(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MS - 24 * 60 * 60 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-${String(wib.getUTCDate()).padStart(2, "0")}`;
}