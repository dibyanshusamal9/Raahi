import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Lavender theme. moss/sand keep their names so existing classes
        // pick up the new accent: moss is the primary violet, sand its tint.
        ink: "#14112B",
        "ink-soft": "#5B5872",
        "ink-faint": "#727089",   // ≥4.5:1 on white; use ink-soft on the sky
        line: "#ECEAF3",
        canvas: "#F7F6FB",
        sand: "#F5F1FF",
        ember: "#B45309",
        moss: "#7C3AED",
        violet: { 50: "#F5F1FF", 100: "#EDE5FF" },
      },
      fontFamily: {
        // Hind after Inter: Devanagari (names, places) renders in Hind.
        sans: ["var(--font-sans)", "var(--font-brand)", ...defaultTheme.fontFamily.sans],
        brand: ["var(--font-brand)", "sans-serif"],
        logo: ["var(--font-logo)", "var(--font-brand)", "serif"],   // the राही wordmark
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,17,43,.04), 0 8px 24px rgba(124,58,237,.06)",
        lift: "0 2px 4px rgba(20,17,43,.05), 0 18px 40px -8px rgba(124,58,237,.18)",
        glow: "0 8px 20px -8px rgba(124,58,237,.75)",
      },
    },
  },
  plugins: [],
};
export default config;
