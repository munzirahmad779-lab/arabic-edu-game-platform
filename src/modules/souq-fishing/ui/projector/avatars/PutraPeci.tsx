import React from "react";
import type { AvatarProps } from "./PutriHijab";

/**
 * Putra Berpeci (أخ بالقلنسوة) — Character 3 (Blue / Putra Peci)
 * SVG 24x32, <2 KB.
 */
export function PutraPeci({ className = "", size = 28 }: AvatarProps) {
  return (
    <svg
      width={size}
      height={(size * 32) / 24}
      viewBox="0 0 24 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      data-avatar="putra_peci"
    >
      {/* Shadow */}
      <ellipse cx="12" cy="30" rx="8" ry="2" fill="rgba(0,0,0,0.25)" />
      {/* Koko Body */}
      <path
        d="M6 18 L18 18 L18 29 C18 29.5 17.5 30 17 30 L7 30 C6.5 30 6 29.5 6 29 Z"
        fill="#2563eb"
      />
      {/* Koko Collar */}
      <path d="M12 18 L12 24" stroke="#ffffff" strokeWidth="1" />
      {/* Face */}
      <ellipse cx="12" cy="12.5" rx="4.5" ry="4.5" fill="#fde68a" />
      {/* Black Peci */}
      <path
        d="M7 10 L7 6 C7 5 9 4.5 12 4.5 C15 4.5 17 5 17 6 L17 10 Z"
        fill="#0f172a"
      />
      {/* Peci Gold Trim */}
      <line x1="7" y1="9.5" x2="17" y2="9.5" stroke="#f59e0b" strokeWidth="0.8" />
      {/* Eyes */}
      <circle cx="10.2" cy="12.5" r="0.75" fill="#1e293b" />
      <circle cx="13.8" cy="12.5" r="0.75" fill="#1e293b" />
      {/* Smile */}
      <path
        d="M10.8 14.5 Q12 15.5 13.2 14.5"
        stroke="#78350f"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
