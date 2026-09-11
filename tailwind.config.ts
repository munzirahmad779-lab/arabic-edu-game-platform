import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // Arabic-first: Noto Naskh Arabic / Noto Sans Arabic style stacks.
        // Actual font loading (next/font, self-hosted, etc.) is a Phase 2+ UI concern;
        // this stack is a safe fallback so Arabic text never falls back to a Latin-only font.
        arabic: [
          "Noto Naskh Arabic",
          "Noto Sans Arabic",
          "Tahoma",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
