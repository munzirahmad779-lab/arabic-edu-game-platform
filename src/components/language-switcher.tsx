"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { setLocale } from "@/lib/i18n/actions";

const LABELS: Record<Locale, string> = {
  id: "Indonesia",
  ar: "العربية",
  en: "English",
};

const FLAGS: Record<Locale, string> = {
  id: "🇮🇩",
  ar: "🇸🇦",
  en: "🇬🇧",
};

export function LanguageSwitcher({ current }: { current: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const fd = new FormData();
    fd.set("locale", e.target.value);
    start(async () => {
      await setLocale(fd);
      router.refresh();
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-1.5 shadow-sm">
      <span className="text-sm">🌐</span>
      <select
        value={current}
        onChange={handleChange}
        disabled={pending}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-xs font-bold text-neutral-700 outline-none disabled:opacity-50"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {FLAGS[l]} {LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}