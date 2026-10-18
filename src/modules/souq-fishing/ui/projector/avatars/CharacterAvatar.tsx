import React from "react";
import { PutriHijab } from "./PutriHijab";
import { PutriNonHijab } from "./PutriNonHijab";
import { PutraPeci } from "./PutraPeci";
import { PutraNonPeci } from "./PutraNonPeci";

export interface CharacterAvatarProps {
  characterId: string;
  size?: number;
  className?: string;
}

export function CharacterAvatar({
  characterId,
  size = 28,
  className = "",
}: CharacterAvatarProps) {
  switch (characterId) {
    case "putri_hijab":
      return <PutriHijab size={size} className={className} />;
    case "putri_non_hijab":
      return <PutriNonHijab size={size} className={className} />;
    case "putra_peci":
      return <PutraPeci size={size} className={className} />;
    case "putra_non_peci":
      return <PutraNonPeci size={size} className={className} />;
    default:
      return <PutriHijab size={size} className={className} />;
  }
}
