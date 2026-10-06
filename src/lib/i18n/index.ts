import type { Dictionary, Locale } from "./types";
import { arDictionary } from "./ar";
import { idDictionary } from "./id";
import { enDictionary } from "./en";

const dictionaries: Record<Locale, Dictionary> = {
  ar: arDictionary,
  id: idDictionary,
  en: enDictionary,
};

export function getDictionary(locale: Locale = "ar"): Dictionary {
  return dictionaries[locale] ?? arDictionary;
}

export type { Dictionary, Locale };
