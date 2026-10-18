import React from "react";
import type { AvatarProps } from "./PutriHijab";

/**
 * Putra Mandiri (أخ) — Character 4 (Yellow / Putra Non-Peci)
 * SVG 24x32, <2 KB.
 */
export function PutraNonPeci({ className = "", size = 28 }: AvatarProps) {
  return (
    <svg
      width={size}
      height={(size * 32) / 24}
      viewBox="0 0 24 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      data-avatar="putra_non_peci"
    >
      {/* Shadow */}
      <ellipse cx="12" cy="30" rx="8" ry="2" fill="rgba(0,0,0,0.25)" />
      {/* Shirt Body */}
      <path
        d="M6 18 L18 18 L18 29 C18 29.5 17.5 30 17 30 L7 30 C6.5 30 6 29.5 6 29 Z"
        fill="#eab308"
      />
      {/* Collar */}
      <path d="M9 18 L12 21 L15 18" stroke="#a16207" strokeWidth="1" fill="none" />
      {/* Face */}
      <ellipse cx="12" cy="12" rx="4.5" ry="4.5" fill="#fde68a" />
      {/* Short Hair */}
      <path
        d="M7 11 C7 6 9 5 12 5 C15 5 17 6 17 11 C17 11.5 16 11 15 10 C14 9.5 13 10 12 9 C11 10 10 9.5 9 10 C8 11 7 11.5 7 11 Z"
        fill="#451a03"
      />
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
