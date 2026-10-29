"use client";

import { useEffect, useState } from "react";

export function GamePackControl() {
  const [attached, setAttached] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/game-pack", { cache: "no-store" });
    const data = await response.json();
    setAttached(data.attached === true);
  }

  useEffect(() => { void refresh(); }, []);

  async function change(action: "attach" | "detach") {
    if (busy) return;
    if (!window.confirm(action === "detach" ? "Lepas game pack sekarang?" : "Pasang kembali game pack sekarang?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/game-pack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Operasi gagal");
      setAttached(data.attached === true);
      setMessage(action === "detach" ? "Game pack dilepas." : "Game pack terpasang kembali.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Operasi gagal"); }
    finally { setBusy(false); }
  }

  return <section className="rounded-[2rem] border border-indigo-200 bg-indigo-50 p-6 shadow-lg">
    <p className="text-xs font-black uppercase tracking-wider text-indigo-700">Super Admin</p>
    <h2 className="mt-1 text-lg font-black text-indigo-950">Kelola Game Pack</h2>
    <p className="mt-1 text-sm text-indigo-900/70">Pasang atau lepas 32 engine game tanpa mengubah akun lain.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-900">Status: {attached === null ? "memuat…" : attached ? "terpasang" : "dilepas"}</span>
      {attached ? <button onClick={() => void change("detach")} disabled={busy} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{busy ? "..." : "Lepas game pack"}</button> : <button onClick={() => void change("attach")} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{busy ? "..." : "Pasang game pack"}</button>}
    </div>
    {message ? <p className="mt-3 text-xs font-bold text-indigo-900">{message}</p> : null}
  </section>;
}
