import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#E6EDF3",
        muted: "#8B949E",
        vessel: "#090D14",
        surface: "#111622",
        "surface-elevated": "#192030",
        rule: "#222B3D",
        accent: {
          DEFAULT: "#8B5CF6",
          fg: "#38BDF8",
        },
        glow: "#38BDF8",
        found: "#10B981",
        gold: "#F59E0B",
      },
    },
  },
  plugins: [],
};
export default config;
