"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";

type StatusDict = {
  error_title: string;
  error_desc: string;
  error_retry: string;
};

const DICT_LOADERS: Record<
  Locale,
  () => Promise<{ status: StatusDict }>
> = {
  id: () =>
    import("@/lib/i18n/id.json").then(
      (m) => m.default as unknown as { status: StatusDict },
    ),
  en: () =>
    import("@/lib/i18n/en.json").then(
      (m) => m.default as unknown as { status: StatusDict },
    ),
  ar: () =>
    import("@/lib/i18n/ar.json").then(
      (m) => m.default as unknown as { status: StatusDict },
    ),
};

function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  const v = m ? decodeURIComponent(m[1]) : DEFAULT_LOCALE;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export default function Error({ reset }: { reset: () => void }) {
  const [t, setT] = useState<StatusDict | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mod = await DICT_LOADERS[readLocale()]();
        if (alive) setT(mod.status);
      } catch {
        // ignore, fallback english
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const title = t?.error_title ?? "An unexpected error occurred";
  const desc =
    t?.error_desc ?? "An error occurred. Please try again.";
  const retry = t?.error_retry ?? "Try Again";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-neutral-600">{desc}</p>
      <button
        onClick={reset}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
      >
        {retry}
      </button>
    </div>
  );
}