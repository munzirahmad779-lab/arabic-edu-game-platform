export default function GamesLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 text-center shadow-xl">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-cyan-300" />
        <p className="mt-3 text-sm font-bold text-white/75">Menyiapkan arena…</p>
      </div>
    </main>
  );
}
