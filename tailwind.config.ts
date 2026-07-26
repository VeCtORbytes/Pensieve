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
        ink: "#141A22",
        muted: "#6E7781",
        vessel: "#F5F7F8",
        surface: "#FFFFFF",
        "surface-elevated": "#FFFFFF",
        rule: "#E2E7EA",
        accent: {
          DEFAULT: "#3B4CC0",
          fg: "#1D9E75",
        },
        glow: "#0969DA",
        found: "#1D9E75",
        gold: "#D97706",
      },
    },
  },
  plugins: [],
};
export default config;
