import type { Config } from "tailwindcss";

/* The design system lives in src/app/globals.css as custom properties and
   semantic classes. Tailwind is here for its preflight and nothing else: no
   utility class is used anywhere on the site, and globals.css no longer asks
   for the utilities layer, so there is nothing to scan for and nothing to
   extend. `content` still names the files preflight is generated against.
   No dark mode: the site is light only. */
export default {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
} satisfies Config;
