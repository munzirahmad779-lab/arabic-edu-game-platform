import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function Loading() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-neutral-500">{dict.status.loading}</p>
    </div>
  );
}