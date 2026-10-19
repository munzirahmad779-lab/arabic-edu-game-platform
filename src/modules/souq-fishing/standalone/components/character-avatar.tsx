import React from "react";
import type { CharacterChoice, TeamColor } from "../types";
import { TEAM_LANE_OFFSETS } from "../engine";

interface Props {
  character?: CharacterChoice;
  teamColor?: TeamColor;
  size?: "sm" | "md" | "lg" | "xl";
  showRibbon?: boolean;
  isWalking?: boolean;
  className?: string;
}

export function CharacterAvatar({
  character = "putra_peci",
  teamColor = "MERAH",
  size = "md",
  showRibbon = true,
  isWalking = false,
  className = "",
}: Props) {
  const lane = TEAM_LANE_OFFSETS[teamColor];

  // Size mapping (px)
  const dimensions = {
    sm: { width: 36, height: 50 },
    md: { width: 54, height: 75 },
    lg: { width: 72, height: 100 },
    xl: { width: 96, height: 130 },
  }[size];

  return (
    <div
      className={`inline-flex flex-col items-center justify-center transition-transform duration-300 ${
        isWalking ? "animate-bounce" : ""
      } ${className}`}
      style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))" }}
    >
      {/* Ribbon Banner Di Atas Kepala */}
      {showRibbon && (
        <div
          className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase text-white shadow-md border border-white/40 mb-1 whitespace-nowrap"
          style={{ backgroundColor: lane.colorHex }}
        >
          {lane.label}
        </div>
      )}

      {/* SVG Karakter Utuh Berbadan & Berkepala */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 64 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Bayangan di Kaki */}
        <ellipse cx="32" cy="84" rx="18" ry="4" fill="rgba(0,0,0,0.25)" />

        {/* --- KARAKTER 1: PUTRA PECI (SANTRI) --- */}
        {character === "putra_peci" && (
          <g id="putra-peci">
            {/* Kaki & Celana / Sarung */}
            <rect x="22" y="60" width="8" height="20" rx="3" fill="#1E293B" />
            <rect x="34" y="60" width="8" height="20" rx="3" fill="#1E293B" />
            {/* Sepatu */}
            <ellipse cx="25" cy="80" rx="6" ry="3" fill="#0F172A" />
            <ellipse cx="39" cy="80" rx="6" ry="3" fill="#0F172A" />

            {/* Baju Koko Santri */}
            <rect x="18" y="36" width="28" height="28" rx="6" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
            {/* Selendang / Rompi Tim */}
            <path d="M 18 42 L 32 58 L 46 42" stroke={lane.colorHex} strokeWidth="4" fill="none" />
            <circle cx="32" cy="46" r="3" fill={lane.colorHex} />

            {/* Lengan Baju */}
            <rect x="10" y="38" width="8" height="18" rx="4" fill="#F8FAFC" />
            <rect x="46" y="38" width="8" height="18" rx="4" fill="#F8FAFC" />
            {/* Tangan */}
            <circle cx="14" cy="56" r="3.5" fill="#FBCFE8" />
            <circle cx="50" cy="56" r="3.5" fill="#FBCFE8" />

            {/* Leher & Kepala */}
            <rect x="28" y="30" width="8" height="8" rx="2" fill="#FBCFE8" />
            <circle cx="32" cy="22" r="14" fill="#FBCFE8" />

            {/* Mata & Senyum */}
            <circle cx="27" cy="21" r="2" fill="#0F172A" />
            <circle cx="37" cy="21" r="2" fill="#0F172A" />
            <circle cx="28" cy="20" r="0.8" fill="#FFFFFF" />
            <circle cx="38" cy="20" r="0.8" fill="#FFFFFF" />
            <path d="M 28 26 Q 32 30 36 26" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            {/* Pipi Merona */}
            <circle cx="24" cy="24" r="2" fill="#FDA4AF" opacity="0.6" />
            <circle cx="40" cy="24" r="2" fill="#FDA4AF" opacity="0.6" />

            {/* Peci Beludru Hitam dengan List Emas */}
            <path d="M 19 15 Q 32 12 45 15 L 45 9 Q 32 6 19 9 Z" fill="#0F172A" stroke="#F59E0B" strokeWidth="1" />
          </g>
        )}

        {/* --- KARAKTER 2: PUTRI HIJAB (SANTRIWATI) --- */}
        {character === "putri_hijab" && (
          <g id="putri-hijab">
            {/* Gamis Santriwati Panjang Berwarna Tim */}
            <path d="M 16 46 L 10 78 L 54 78 L 48 46 Z" fill="#334155" />
            <path d="M 20 48 L 14 78 L 50 78 L 44 48 Z" fill={lane.colorHex} opacity="0.9" />
            {/* Sepatu */}
            <ellipse cx="24" cy="80" rx="5" ry="3" fill="#0F172A" />
            <ellipse cx="40" cy="80" rx="5" ry="3" fill="#0F172A" />

            {/* Lengan Gamis */}
            <rect x="8" y="44" width="8" height="18" rx="4" fill={lane.colorHex} />
            <rect x="48" y="44" width="8" height="18" rx="4" fill={lane.colorHex} />
            {/* Tangan */}
            <circle cx="12" cy="62" r="3" fill="#FED7AA" />
            <circle cx="52" cy="62" r="3" fill="#FED7AA" />

            {/* Hijab Syari Menutup Dada */}
            <path
              d="M 14 26 C 14 8, 50 8, 50 26 C 50 42, 46 54, 32 54 C 18 54, 14 42, 14 26 Z"
              fill="#F8FAFC"
              stroke="#E2E8F0"
              strokeWidth="1.5"
            />
            {/* Bros Emas Hijab */}
            <circle cx="32" cy="46" r="2.5" fill="#F59E0B" />

            {/* Wajah di Dalam Hijab */}
            <ellipse cx="32" cy="24" rx="10" ry="11" fill="#FED7AA" />
            {/* Mata Indah & Senyum */}
            <circle cx="28" cy="23" r="1.8" fill="#0F172A" />
            <circle cx="36" cy="23" r="1.8" fill="#0F172A" />
            <circle cx="29" cy="22" r="0.7" fill="#FFFFFF" />
            <circle cx="37" cy="22" r="0.7" fill="#FFFFFF" />
            <path d="M 29 28 Q 32 31 35 28" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            {/* Pipi Merona */}
            <circle cx="26" cy="26" r="2" fill="#FB7185" opacity="0.6" />
            <circle cx="38" cy="26" r="2" fill="#FB7185" opacity="0.6" />
          </g>
        )}

        {/* --- KARAKTER 3: PUTRA NON-PECI --- */}
        {character === "putra_non_peci" && (
          <g id="putra-non-peci">
            {/* Celana */}
            <rect x="22" y="58" width="8" height="22" rx="3" fill="#1E293B" />
            <rect x="34" y="58" width="8" height="22" rx="3" fill="#1E293B" />
            {/* Sepatu Kets */}
            <ellipse cx="25" cy="80" rx="6" ry="3" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1" />
            <ellipse cx="39" cy="80" rx="6" ry="3" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1" />

            {/* Kaos / Jaket Keren */}
            <rect x="18" y="34" width="28" height="26" rx="6" fill="#3B82F6" />
            <rect x="20" y="34" width="24" height="26" rx="5" fill={lane.colorHex} />
            {/* Lambang Tim di Dada */}
            <circle cx="32" cy="44" r="5" fill="#FFFFFF" opacity="0.9" />
            <polygon points="32,41 34,46 30,46" fill={lane.colorHex} />

            {/* Lengan & Tangan */}
            <rect x="10" y="36" width="8" height="18" rx="4" fill={lane.colorHex} />
            <rect x="46" y="36" width="8" height="18" rx="4" fill={lane.colorHex} />
            <circle cx="14" cy="54" r="3.5" fill="#FDBA74" />
            <circle cx="50" cy="54" r="3.5" fill="#FDBA74" />

            {/* Leher & Kepala */}
            <rect x="28" y="28" width="8" height="8" rx="2" fill="#FDBA74" />
            <circle cx="32" cy="20" r="13" fill="#FDBA74" />

            {/* Rambut Keren Bergaya */}
            <path
              d="M 18 18 C 18 8, 46 8, 46 18 C 44 14, 40 10, 32 10 C 24 10, 20 14, 18 18 Z"
              fill="#18181B"
            />
            <path d="M 20 16 Q 30 11 44 15" stroke="#18181B" strokeWidth="4" strokeLinecap="round" />

            {/* Mata & Senyum */}
            <circle cx="28" cy="20" r="2" fill="#0F172A" />
            <circle cx="36" cy="20" r="2" fill="#0F172A" />
            <path d="M 28 25 Q 32 29 36 25" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* --- KARAKTER 4: PUTRI NON-HIJAB --- */}
        {character === "putri_non_hijab" && (
          <g id="putri-non-hijab">
            {/* Rok & Kaki */}
            <polygon points="20,54 44,54 50,70 14,70" fill={lane.colorHex} />
            <rect x="24" y="68" width="5" height="12" rx="2" fill="#FBCFE8" />
            <rect x="35" y="68" width="5" height="12" rx="2" fill="#FBCFE8" />
            <ellipse cx="26" cy="80" rx="5" ry="3" fill="#F43F5E" />
            <ellipse cx="37" cy="80" rx="5" ry="3" fill="#F43F5E" />

            {/* Blus Baju */}
            <rect x="20" y="34" width="24" height="22" rx="6" fill="#FDF2F8" stroke="#F472B6" strokeWidth="1.5" />
            <polygon points="32,34 26,42 38,42" fill={lane.colorHex} />

            {/* Lengan & Tangan */}
            <rect x="12" y="36" width="8" height="16" rx="4" fill="#FDF2F8" />
            <rect x="44" y="36" width="8" height="16" rx="4" fill="#FDF2F8" />
            <circle cx="16" cy="52" r="3.5" fill="#FBCFE8" />
            <circle cx="48" cy="52" r="3.5" fill="#FBCFE8" />

            {/* Rambut Kuncir Dua di Kiri & Kanan */}
            <ellipse cx="14" cy="20" rx="6" ry="8" fill="#451A03" />
            <ellipse cx="50" cy="20" rx="6" ry="8" fill="#451A03" />
            <circle cx="16" cy="18" r="3" fill="#F43F5E" />
            <circle cx="48" cy="18" r="3" fill="#F43F5E" />

            {/* Leher & Kepala */}
            <rect x="28" y="28" width="8" height="8" rx="2" fill="#FBCFE8" />
            <circle cx="32" cy="20" r="13" fill="#FBCFE8" />

            {/* Poni Rambut */}
            <path d="M 19 18 C 23 10, 41 10, 45 18 C 40 14, 34 14, 32 15 C 30 14, 24 14, 19 18 Z" fill="#451A03" />

            {/* Mata Berbinar & Senyum */}
            <circle cx="28" cy="20" r="2" fill="#0F172A" />
            <circle cx="36" cy="20" r="2" fill="#0F172A" />
            <circle cx="29" cy="19" r="0.8" fill="#FFFFFF" />
            <circle cx="37" cy="19" r="0.8" fill="#FFFFFF" />
            <path d="M 28 25 Q 32 29 36 25" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            {/* Pipi Blushing */}
            <circle cx="25" cy="23" r="2.5" fill="#FDA4AF" opacity="0.7" />
            <circle cx="39" cy="23" r="2.5" fill="#FDA4AF" opacity="0.7" />
          </g>
        )}
      </svg>
    </div>
  );
}
