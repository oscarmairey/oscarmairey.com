import type { Config } from "tailwindcss";

/* The design system lives in src/app/globals.css as custom properties and
   semantic classes. Tailwind is kept for its preflight and for the handful of
   utilities used in layout. No dark mode: the site is light only. */
export default {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        rule: "var(--rule)",
        oxide: "var(--oxide)",
      },
      fontFamily: {
        reading: ["var(--font-reading)", "Literata", "Georgia", "serif"],
      },
    },
  },
} satisfies Config;
