import React from "react";

export interface AvatarProps {
  className?: string;
  size?: number;
}

/**
 * Putri Berhijab (أخت محجبة) — Character 1 (Red / Putri Hijab)
 * SVG 24x32, <2 KB.
 */
export function PutriHijab({ className = "", size = 28 }: AvatarProps) {
  return (
    <svg
      width={size}
      height={(size * 32) / 24}
      viewBox="0 0 24 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      data-avatar="putri_hijab"
    >
      {/* Shadow */}
      <ellipse cx="12" cy="30" rx="8" ry="2" fill="rgba(0,0,0,0.25)" />
      {/* Abaya Body */}
      <path
        d="M6 19 L18 19 L20 29 C20 29.5 19.5 30 19 30 L5 30 C4.5 30 4 29.5 4 29 Z"
        fill="#dc2626"
      />
      {/* Hijab Drape */}
      <path
        d="M6 10 C6 6 8 4 12 4 C16 4 18 6 18 10 C18 14 17 20 12 21 C7 20 6 14 6 10 Z"
        fill="#b91c1c"
      />
      {/* Face Oval */}
      <ellipse cx="12" cy="11" rx="4" ry="4.5" fill="#fde68a" />
      {/* Eyes */}
      <circle cx="10.5" cy="10.5" r="0.75" fill="#1e293b" />
      <circle cx="13.5" cy="10.5" r="0.75" fill="#1e293b" />
      {/* Smile */}
      <path
        d="M10.8 13 Q12 14 13.2 13"
        stroke="#78350f"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      {/* Hijab Inner Frame */}
      <path
        d="M8 8 C8 7 10 6 12 6 C14 6 16 7 16 8 C16 9 15.5 12 12 12 C8.5 12 8 9 8 8 Z"
        fill="#991b1b"
        opacity="0.3"
      />
    </svg>
  );
}
