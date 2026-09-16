"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "forgot";

const WA_NUMBER = "6281354229189";

const WA_MESSAGE = `Halo Admin Arabic Edu Game,

Saya ingin mendaftar sebagai guru di platform.

Nama:
Email:
Password (opsional — kosongkan jika ingin admin yang buatkan):

Terima kasih.`;

const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_MESSAGE)}`;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get("redirectTo");
  const redirectTo =
    requestedRedirect &&
    requestedRedirect.startsWith("/") &&
    !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/dashboard";

  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();

    try {
      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        router.replace(redirectTo);
        router.refresh();
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        );
        if (resetError) {
          setError(resetError.message);
          return;
        }
        setInfoMessage(
          "Link reset password sudah dikirim ke email Anda. Cek inbox atau folder spam.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6"
      dir="rtl"
    >
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <Link
            href="/"
            className="text-xs font-bold text-violet-600 hover:underline"
          >
            ← Kembali ke Halaman Utama
          </Link>
          <h1 className="mt-4 text-2xl font-black text-neutral-900">
            {mode === "sign_in" ? "🎓 Login Guru" : "🔑 Lupa Password"}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {mode === "sign_in"
              ? "Masukkan email dan password untuk masuk ke dashboard."
              : "Masukkan email Anda, kami akan kirim link reset password."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-violet-100 bg-white p-6 shadow-xl"
          noValidate
        >
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm font-bold text-neutral-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              autoComplete="email"
              dir="ltr"
            />
          </div>

          {mode === "sign_in" ? (
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="block text-sm font-bold text-neutral-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
            >
              {error}
            </p>
          ) : null}

          {infoMessage ? (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
            >
              {infoMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isSubmitting
              ? "..."
              : mode === "sign_in"
                ? "Login"
                : "Kirim Link Reset Password"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign_in" ? "forgot" : "sign_in");
            setError(null);
            setInfoMessage(null);
          }}
          className="w-full text-center text-sm font-bold text-violet-700 underline"
        >
          {mode === "sign_in" ? "Lupa Password?" : "← Kembali ke Login"}
        </button>

        {/* Daftar via WhatsApp */}
        <div className="rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center">
          <p className="text-sm font-black text-emerald-900">
            Belum punya akun guru?
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Klik tombol di bawah untuk menghubungi admin via WhatsApp.
          </p>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"
          >
            <span className="text-xl">📱</span>
            <span>Daftar via WhatsApp</span>
          </a>
          <p className="mt-3 text-[10px] text-emerald-600">
            Pesan otomatis akan terbuka — isi nama, email, dan (opsional)
            password yang Anda inginkan.
          </p>
        </div>

        <p className="text-center text-xs text-neutral-400">
          Pendaftaran mandiri dinonaktifkan. Semua akun dibuat oleh admin.
        </p>
      </div>
    </main>
  );
}