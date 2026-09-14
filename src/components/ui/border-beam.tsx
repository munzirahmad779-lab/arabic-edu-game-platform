import type { CSSProperties, ReactNode } from "react";

type BorderBeamProps = {
  children: ReactNode;
  className?: string;
  durationSeconds?: number;
  colorFrom?: string;
  colorTo?: string;
};

const BEAM_CSS = `
  @keyframes border-beam-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .border-beam-spin {
    animation: border-beam-spin var(--beam-duration, 4s) linear infinite;
  }
`;

/**
 * Bingkai card dengan efek "beam" berjalan di sekeliling border.
 * Pure CSS (tanpa library). Bungkus konten Anda dengan komponen ini.
 */
export function BorderBeam({
  children,
  className = "",
  durationSeconds = 4,
  colorFrom = "#a78bfa",
  colorTo = "#f0abfc",
}: BorderBeamProps) {
  const style: CSSProperties = {
    ["--beam-duration" as never]: `${durationSeconds}s`,
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={style}
    >
      <style dangerouslySetInnerHTML={{ __html: BEAM_CSS }} />
      <div className="pointer-events-none absolute inset-0">
        <div
          className="border-beam-spin absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2"
          style={{
            background: `conic-gradient(from 90deg, transparent 0%, ${colorFrom} 40%, ${colorTo} 50%, ${colorFrom} 60%, transparent 100%)`,
          }}
        />
      </div>
      <div className="relative m-[1.5px] rounded-2xl bg-white">
        {children}
      </div>
    </div>
  );
}