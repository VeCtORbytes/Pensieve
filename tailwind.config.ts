import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        ink: "#1A1D26",
        muted: "#6B6F76",
        vessel: "#FAF9F6",
        surface: "#FFFFFF",
        "surface-elevated": "#FFFFFF",
        rule: "#E6E4DD",
        accent: {
          DEFAULT: "#2C4A7C",
          fg: "#4B7A51",
        },
        secondary: "#C1652D",
        glow: "#C1652D",
        found: "#4B7A51",
        gold: "#B8802E",
      },
    },
  },
  plugins: [],
};
export default config;
