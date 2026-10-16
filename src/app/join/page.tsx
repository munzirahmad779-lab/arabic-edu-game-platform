import { joinRoom } from "./actions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: { error?: string; code?: string; name?: string };
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const t = dict.join;

  const prefilledCode = (searchParams.code ?? "").trim().toUpperCase();
  const prefilledName = (searchParams.name ?? "").trim();

  const ERROR_MESSAGES: Record<string, string> = {
    room_not_found: "Kode ruangan tidak ditemukan atau sudah ditutup. Pastikan kode sudah benar.",
    room_not_open: "Ruangan kuis belum dibuka oleh guru.",
    room_full: "Ruangan kuis sudah penuh.",
    pin_required: "Ruangan ini membutuhkan PIN untuk masuk.",
    invalid_pin: "PIN yang dimasukkan salah.",
    student_not_found: "Nama siswa tidak terdaftar di daftar absensi kelas ini.",
    already_joined: "Nama Anda sudah terdaftar di sesi ruangan ini.",
    invalid_name: "Nama tidak valid. Masukkan nama asli Anda.",
    incomplete: "Harap isi kode ruangan dan nama Anda.",
    generic: "Gagal bergabung ke ruangan. Coba lagi atau tanyakan kepada guru.",
  };

  const errorMessage = searchParams.error
    ? ERROR_MESSAGES[searchParams.error] || searchParams.error
    : null;

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

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1 leading-relaxed">
              {errorMessage}
              {searchParams.error && searchParams.error !== errorMessage ? (
                <span className="block text-[11px] font-mono text-red-500/80 mt-1">
                  ({searchParams.error})
                </span>
              ) : null}
            </div>
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
              defaultValue={prefilledName}
              required
              maxLength={100}
              autoFocus={Boolean(prefilledCode && !prefilledName)}
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
            className="w-full rounded-2xl bg-violet-600 px-5 py-3.5 font-black text-white transition hover:bg-violet-700 shadow-lg shadow-violet-200"
          >
            {t.submit_btn}
          </button>
        </form>

        <div className="mt-6 rounded-3xl border border-violet-200/80 bg-white/80 backdrop-blur p-4 text-center shadow-md">
          <p className="text-xs font-semibold text-neutral-600">
            Ingin menggunakan HP sebagai remote tombol untuk Proyektor Kelas?
          </p>
          <a
            href={`/controller${prefilledCode ? `?room=${prefilledCode}` : ""}`}
            className="mt-2.5 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-50 px-4 py-2 text-xs font-black text-violet-700 border border-violet-200 hover:bg-violet-100 transition"
          >
            <span>📱</span> Buka Kontroler Remote Proyektor
          </a>
        </div>
      </div>
    </main>
  );
}