import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // The design tokens declared in globals.css, exposed as utilities so
      // components can use `bg-accent` / `border-rule` instead of raw hex.
      colors: {
        ink: "#141A22",
        vessel: "#F5F7F8",
        surface: "#FFFFFF",
        rule: "#E2E7EA",
        // Single brand accent. Also carries the "grounded / retrieved" meaning
        // that used to have its own colour.
        accent: {
          DEFAULT: "#1D9E75",
          fg: "#0B5C43",
        },
      },
    },
  },
  plugins: [],
};
export default config;
