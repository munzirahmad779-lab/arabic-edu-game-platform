import React from "react";
import { CharacterAvatar } from "../projector/avatars";

export type CharacterId =
  | "putri_hijab"
  | "putri_non_hijab"
  | "putra_peci"
  | "putra_non_peci";

export interface CharacterPickerProps {
  selectedCharacter?: string;
  onSelect: (characterId: CharacterId) => void;
}

const CHARACTERS: { id: CharacterId; name: string; desc: string }[] = [
  {
    id: "putri_hijab",
    name: "Aisyah",
    desc: "Putri Berhijab",
  },
  {
    id: "putri_non_hijab",
    name: "Fatimah",
    desc: "Putri Non-Hijab",
  },
  {
    id: "putra_peci",
    name: "Ahmad",
    desc: "Putra Berpeci",
  },
  {
    id: "putra_non_peci",
    name: "Ibrahim",
    desc: "Putra Non-Peci",
  },
];

export function CharacterPicker({
  selectedCharacter,
  onSelect,
}: CharacterPickerProps) {
  return (
    <div
      className="grid grid-cols-2 gap-2.5 w-full"
      data-testid="character-picker"
    >
      {CHARACTERS.map((char) => {
        const isSelected = selectedCharacter === char.id;
        return (
          <button
            key={char.id}
            type="button"
            onClick={() => onSelect(char.id)}
            data-testid={`character-card-${char.id.toLowerCase()}`}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all min-h-[96px] ${
              isSelected
                ? "border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10 scale-[1.02]"
                : "border-slate-700 bg-slate-900/60 hover:border-slate-600"
            }`}
          >
            <div className="w-8 h-10 flex items-center justify-center mb-1">
              <CharacterAvatar characterId={char.id} size={32} />
            </div>
            <span className="text-xs font-bold text-white leading-tight">
              {char.name}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              {char.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
