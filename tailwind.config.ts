import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        arabic: [
          "Noto Naskh Arabic",
          "Noto Sans Arabic",
          "Tahoma",
          "Arial",
          "sans-serif",
        ],
        display: [
          "var(--font-playfair)",
          "Playfair Display",
          "Georgia",
          "serif",
        ],
      },
      colors: {
        warmwhite: "#F9F8F6",
        cream: "#F7F1E8",
        softslate: "#4A5568",
        ink: "#2B2B2B",
        terracotta: {
          50: "#FDF8F6",
          100: "#F9EAE5",
          500: "#D97757",
          600: "#C25F3E",
          700: "#A84B2E",
        },
        teal: {
          50: "#EEF4F4",
          100: "#D4E3E4",
          500: "#2F6D72",
          600: "#255759",
          700: "#1F4A4E",
        },
        sage: {
          50: "#F2F5F2",
          100: "#E1EBE2",
          200: "#D4DDD0",
          500: "#8FA68E",
          600: "#698A6C",
        },
      },
      animation: {
        "blob-breathe": "blobBreathing 12s infinite alternate ease-in-out",
        "soft-float": "softFloating 6s infinite ease-in-out",
        "soft-float-delayed": "softFloating 6s 1.5s infinite ease-in-out",
        marquee: "scrollMarquee 35s linear infinite",
        "fade-up": "fadeUp 0.7s ease-out both",
      },
      keyframes: {
        blobBreathing: {
          "0%": { borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%" },
          "50%": { borderRadius: "60% 40% 30% 70% / 50% 60% 40% 50%" },
          "100%": { borderRadius: "30% 70% 50% 50% / 60% 40% 70% 40%" },
        },
        softFloating: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-15px)" },
        },
        scrollMarquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;