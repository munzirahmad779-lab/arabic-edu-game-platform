export function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      {/* Organic blobs */}
      <div className="absolute -inset-6 -z-10">
        <div className="absolute -left-4 top-4 h-64 w-64 animate-blob-breathe rounded-full bg-sage-500/25 blur-2xl" />
        <div
          className="absolute bottom-0 right-0 h-64 w-64 animate-blob-breathe rounded-full bg-terracotta-500/25 blur-2xl"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Main card */}
      <div className="relative rounded-[2.5rem] border border-white/60 bg-white/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-terracotta-500 p-4 text-white shadow-lg">
            <div className="text-3xl">📖</div>
            <p className="mt-2 text-xs font-black">Materi Interaktif</p>
          </div>
          <div className="rounded-2xl bg-teal-500 p-4 text-white shadow-lg">
            <div className="text-3xl">🎮</div>
            <p className="mt-2 text-xs font-black">4 Mode Game</p>
          </div>
          <div className="rounded-2xl bg-sage-500 p-4 text-white shadow-lg">
            <div className="text-3xl">✍️</div>
            <p className="mt-2 text-xs font-black">Esai + AI</p>
          </div>
          <div className="rounded-2xl bg-teal-700 p-4 text-white shadow-lg">
            <div className="text-3xl">📊</div>
            <p className="mt-2 text-xs font-black">Laporan Harian</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-sage-200 bg-white/70 p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-terracotta-500" />
            <div className="h-2 w-20 rounded-full bg-sage-500/60" />
            <div className="h-2 w-10 rounded-full bg-sage-500/40" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-2 w-full rounded-full bg-sage-500/25" />
            <div className="h-2 w-4/5 rounded-full bg-sage-500/25" />
            <div className="h-2 w-3/5 rounded-full bg-sage-500/25" />
          </div>
        </div>
      </div>

      {/* Floating card 1 */}
      <div className="absolute -bottom-6 -left-6 flex animate-soft-float items-center gap-3 rounded-2xl border border-sage-200 bg-white p-3 pr-5 shadow-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-terracotta-500 to-terracotta-600 text-lg text-white">
          👤
        </div>
        <div>
          <p className="text-xs font-black text-teal-700">Ahmad Yusuf</p>
          <p className="text-[10px] text-softslate/70">Guru · 12 kelas</p>
        </div>
      </div>

      {/* Floating card 2 */}
      <div className="absolute -right-6 -top-6 flex animate-soft-float-delayed items-center gap-3 rounded-2xl border border-sage-200 bg-white p-3 pr-5 shadow-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-lg text-white">
          ⭐
        </div>
        <div>
          <p className="text-xs font-black text-teal-700">200+ Siswa</p>
          <p className="text-[10px] text-softslate/70">aktif belajar</p>
        </div>
      </div>
    </div>
  );
}