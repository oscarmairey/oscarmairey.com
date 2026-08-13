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
  bio: "Oscar Mairey is an algorithmic asset manager at ARTE One, an AI-native hedge fund in Dubai, where he builds the firm's technology infrastructure. Before ARTE One he was at Chainraizer: he ran operations, wrote the Raizer platform and its smart contracts, and explained the product to institutions. Earlier he was at Ta-da, taking a French-speaking community into eight countries and then moving into sales, and before that the first employee at Le Crypto Daily. He started in crypto in 2020 and has been shipping code since 2021.",
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
