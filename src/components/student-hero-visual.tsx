export function StudentHeroVisual() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-64 w-full items-center justify-center sm:h-80"
    >
      <div className="absolute h-52 w-52 animate-[spin_18s_linear_infinite] rounded-full border border-[#8FA68E]/40 sm:h-64 sm:w-64" />
      <div className="absolute h-40 w-40 animate-[spin_12s_linear_infinite_reverse] rounded-full border-2 border-dashed border-[#D97757]/35 sm:h-48 sm:w-48" />
      <div className="absolute h-28 w-28 rotate-45 rounded-[2rem] bg-gradient-to-br from-[#8FA68E]/60 to-[#D97757]/40 shadow-2xl shadow-[#2F6D72]/20 sm:h-36 sm:w-36" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-white/70 bg-white/80 text-5xl font-black text-[#2F6D72] shadow-xl backdrop-blur-sm sm:h-32 sm:w-32 sm:text-6xl">
        م
      </div>
      <span className="absolute right-[18%] top-[18%] text-3xl text-[#D97757]/70 sm:text-4xl">
        ✦
      </span>
      <span className="absolute bottom-[18%] left-[18%] text-2xl text-[#8FA68E] sm:text-3xl">
        •
      </span>
    </div>
  );
}
