import React from "react";
import type { AvatarProps } from "./PutriHijab";

/**
 * Putri Mandiri (أخت) — Character 2 (Green / Putri Non-Hijab)
 * SVG 24x32, <2 KB.
 */
export function PutriNonHijab({ className = "", size = 28 }: AvatarProps) {
  return (
    <svg
      width={size}
      height={(size * 32) / 24}
      viewBox="0 0 24 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      data-avatar="putri_non_hijab"
    >
      {/* Shadow */}
      <ellipse cx="12" cy="30" rx="8" ry="2" fill="rgba(0,0,0,0.25)" />
      {/* Hair Behind */}
      <path
        d="M6 10 C6 5 8 4 12 4 C16 4 18 5 18 10 C18 16 19 22 19 24 C17 24 16 20 16 18 L8 18 C8 20 7 24 5 24 C5 22 6 16 6 10 Z"
        fill="#334155"
      />
      {/* Dress Body */}
      <path
        d="M7 18 L17 18 L19 29 C19 29.5 18.5 30 18 30 L6 30 C5.5 30 5 29.5 5 29 Z"
        fill="#16a34a"
      />
      {/* Face Oval */}
      <ellipse cx="12" cy="11.5" rx="4.5" ry="5" fill="#fde68a" />
      {/* Front Bangs */}
      <path
        d="M7.5 9 C8.5 7 11 7 12 8 C13 7 15.5 7 16.5 9 C15 8 13.5 8.5 12 8.5 C10.5 8.5 9 8 7.5 9 Z"
        fill="#1e293b"
      />
      {/* Eyes */}
      <circle cx="10.2" cy="11.5" r="0.75" fill="#1e293b" />
      <circle cx="13.8" cy="11.5" r="0.75" fill="#1e293b" />
      {/* Smile */}
      <path
        d="M10.8 14 Q12 15 13.2 14"
        stroke="#78350f"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      {/* Ribbon Hairpin */}
      <circle cx="16" cy="7.5" r="1.5" fill="#f59e0b" />
    </svg>
  );
}
