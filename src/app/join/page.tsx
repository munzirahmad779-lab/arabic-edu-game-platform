import { joinRoom } from "./actions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: { error?: string; code?: string };
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const t = dict.join;

  const prefilledCode = (searchParams.code ?? "").trim().toUpperCase();

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 px-4 py-10"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold text-violet-600">{t.brand}</p>
          <h1 className="mt-2 text-3xl font-black text-neutral-900">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            {prefilledCode ? t.desc_prefilled : t.desc_normal}
          </p>
        </div>

        {searchParams.error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {searchParams.error}
          </div>
        ) : null}

        <form
          action={joinRoom}
          className="space-y-5 rounded-3xl border border-violet-100 bg-white p-6 shadow-xl"
        >
          {prefilledCode ? (
            <>
              <input type="hidden" name="code" value={prefilledCode} />
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                <div className="text-xs font-bold text-emerald-700">
                  {t.code_label}
                </div>
                <div className="mt-1 text-lg font-black tracking-[0.14em] text-emerald-900">
                  {prefilledCode}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="join-code" className="block text-sm font-bold">
                {t.code_label}
              </label>
              <input
                id="join-code"
                name="code"
                required
                maxLength={6}
                minLength={6}
                autoComplete="off"
                placeholder="ZXBJY6"
                autoFocus
                className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-center text-lg font-bold tracking-[0.14em] outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>
          )}

          <div>
            <label htmlFor="join-name" className="block text-sm font-bold">
              {t.name_label}
            </label>
            <input
              id="join-name"
              name="name"
              required
              maxLength={100}
              autoFocus={Boolean(prefilledCode)}
              className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <div>
            <label htmlFor="join-pin" className="block text-sm font-bold">
              {t.pin_label}{" "}
              <span className="ms-2 text-xs font-normal text-neutral-500">
                {t.pin_optional}
              </span>
            </label>
            <input
              id="join-pin"
              name="pin"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-center tracking-[0.3em] outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-violet-600 px-5 py-3.5 font-black text-white transition hover:bg-violet-700"
          >
            {t.submit_btn}
          </button>
        </form>
      </div>
    </main>
  );
}