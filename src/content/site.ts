/** Site-wide facts and copy. Source of truth: the validated copy deck.
 *  Rules that apply to every string in this repo:
 *    - a claim is dated, numbered, named, or it does not exist;
 *    - Oscar's age never appears anywhere, in any form;
 *    - the company is spelled "Ko Social Network", never "KOKO". */

export const site = {
  name: "Oscar Mairey",
  url: "https://oscarmairey.com",
  email: "o@mairey.net",
  lastUpdated: "August 2026",
  description:
    "Oscar Mairey builds the technology infrastructure of ARTE One, an AI-native hedge fund based in Dubai. Previously at Chainraizer, Ta-da, and Le Crypto Daily.",
  ogDescription:
    "Algorithmic asset manager at ARTE One. Builds the software behind the funds and products he works on.",
  /** The home page is an index, so the bio is two sentences. The record it
   *  used to carry — Chainraizer, Ta-da, Le Crypto Daily, the dates — lives
   *  on /building. `description` and `ogDescription` stay longer on purpose:
   *  they are the citation surface, not the page. */
  bio: "Oscar Mairey builds the technology infrastructure of ARTE One, an AI-native hedge fund in Dubai. He has been in crypto since 2020 and shipping code since 2021.",
  links: [
    { label: "GitHub", href: "https://github.com/oscarmairey" },
    { label: "X", href: "https://x.com/oscarmairey" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/oscar-mairey/" },
  ],
} as const;

export const nav = [
  { label: "Writings", href: "/writings" },
  { label: "Books", href: "/books" },
  { label: "Building", href: "/building" },
] as const;

export const hooks = {
  writings: "Occasional notes, mostly on markets and the software underneath them.",
  books: "What I've read, and why each one stayed.",
  building: "Five companies since 2020, and what I'm working on now.",
} as const;
