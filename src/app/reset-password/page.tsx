"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";

type ResetDict = {
  checking: string;
  invalid_link_title: string;
  invalid_link_desc: string;
  back_to_login: string;
  title: string;
  desc: string;
  password_label: string;
  confirm_label: string;
  old_label: string;
  err_old_wrong: string;
  err_short: string;
  err_mismatch: string;
  err_conn: string;
  success_info: string;
  save_btn: string;
  submitting: string;
};

const DICT_LOADERS: Record<
  Locale,
  () => Promise<{ reset_pw: ResetDict }>
> = {
  id: () =>
    import("@/lib/i18n/id.json").then(
      (m) => m.default as unknown as { reset_pw: ResetDict },
    ),
  en: () =>
    import("@/lib/i18n/en.json").then(
      (m) => m.default as unknown as { reset_pw: ResetDict },
    ),
  ar: () =>
    import("@/lib/i18n/ar.json").then(
      (m) => m.default as unknown as { reset_pw: ResetDict },
    ),
};

/**
 * Kenali sesi pemulihan dari klaim `amr` pada access token: sesi yang
 * lahir dari tautan reset email membawa metode "recovery". Bentuk entri
 * amr bisa berupa string atau objek { method } tergantung versi server.
 */
function sessionIsRecovery(accessToken: string | undefined): boolean {
  if (!accessToken) return false;
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return false;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { amr?: Array<{ method?: string } | string> };
    return (json.amr ?? []).some((entry) =>
      typeof entry === "string"
        ? entry === "recovery"
        : entry?.method === "recovery",
    );
  } catch {
    return false;
  }
}

function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  const v = m ? decodeURIComponent(m[1]) : DEFAULT_LOCALE;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [t, setT] = useState<ResetDict | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const l = readLocale();
    setLocale(l);
    (async () => {
      try {
        const mod = await DICT_LOADERS[l]();
        setT(mod.reset_pw);
      } catch {
        // ignore
      }
    })();
    const supabase = createClient();

    // Kenali sesi pemulihan dari tiga sinyal: penanda type=recovery
    // pada URL kedatangan, peristiwa PASSWORD_RECOVERY dari klien auth,
    // dan klaim amr "recovery" pada token sesi. Sesi login biasa yang
    // tidak membawa satu pun sinyal ini wajib membuktikan kata sandi
    // lama sebelum boleh mengganti kata sandi (lihat handleSubmit).
    if (window.location.hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionIsRecovery(sessionData.session?.access_token)) {
        setIsRecovery(true);
      }
      const { data } = await supabase.auth.getUser();
      setHasSession(Boolean(data.user));
      setUserEmail(data.user?.email ?? null);
      setChecking(false);
    })();

    return () => authSub.subscription.unsubscribe();
  }, []);

  const isRtl = locale === "ar";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!t) return;
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError(t.err_short);
      return;
    }
    if (password !== confirm) {
      setError(t.err_mismatch);
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();

      // Gerbang kepemilikan sesi: sesi pemulihan (dari tautan email)
      // boleh langsung mengganti kata sandi; sesi login biasa wajib
      // membuktikan kata sandi lama terlebih dahulu, agar sesi yang
      // tertinggal di perangkat bersama tidak bisa dipakai mengambil
      // alih akun.
      if (!isRecovery) {
        if (!userEmail) {
          setError(t.err_conn);
          return;
        }
        const { error: reauthErr } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: oldPassword,
        });
        if (reauthErr) {
          setError(t.err_old_wrong);
          return;
        }
      }

      const { error: updErr } = await supabase.auth.updateUser({ password });

      if (updErr) {
        setError(updErr.message);
      } else {
        // Cabut sesi lain milik akun ini; sesi saat ini dipertahankan.
        try {
          await supabase.auth.signOut({ scope: "others" });
        } catch {
          // ignore: penggantian kata sandi sudah berhasil
        }
        setInfo(t.success_info);
        window.setTimeout(() => {
          router.replace("/dashboard");
          router.refresh();
        }, 1500);
      }
    } catch {
      setError(t.err_conn);
    } finally {
      setSubmitting(false);
    }
  }

  if (checking || !t) {
    return (
      <main
        className="flex min-h-screen items-center justify-center p-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <p className="text-sm text-neutral-500">{t?.checking ?? "..."}</p>
        </div>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 via-white to-rose-50 p-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="text-5xl">⛔</div>
          <h1 className="mt-4 text-xl font-black text-red-700">
            {t.invalid_link_title}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            {t.invalid_link_desc}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white"
          >
            {t.back_to_login}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-black text-neutral-900">{t.title}</h1>
          <p className="mt-2 text-sm text-neutral-500">{t.desc}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-violet-100 bg-white p-6 shadow-xl"
        >
          {!isRecovery ? (
            <div className="space-y-1">
              <label
                htmlFor="old-password"
                className="block text-sm font-bold text-neutral-700"
              >
                {t.old_label}
              </label>
              <input
                id="old-password"
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
          ) : null}

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-sm font-bold text-neutral-700"
            >
              {t.password_label}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              autoComplete="new-password"
              dir="ltr"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="confirm"
              className="block text-sm font-bold text-neutral-700"
            >
              {t.confirm_label}
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              autoComplete="new-password"
              dir="ltr"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
            >
              {error}
            </p>
          ) : null}

          {info ? (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
            >
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {submitting ? t.submitting : t.save_btn}
          </button>
        </form>
      </div>
    </main>
  );
}