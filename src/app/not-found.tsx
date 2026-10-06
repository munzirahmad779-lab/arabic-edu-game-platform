import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function NotFound() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const t = dict.status;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 text-center"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <h1 className="text-lg font-semibold">{t.not_found_title}</h1>
      <p className="max-w-md text-sm text-neutral-600">{t.not_found_desc}</p>
      <Link href="/" className="text-sm text-neutral-600 underline">
        {t.not_found_back}
      </Link>
    </div>
  );
}