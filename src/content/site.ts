import { sectionList } from "@/lib/labels";

/** Site-wide facts and copy. Source of truth: the validated copy deck.
 *  Rules that apply to every string in this repo:
 *    - a claim is dated, numbered, named, or it does not exist;
 *    - Oscar's age never appears anywhere, in any form;
 *    - the company is spelled "Ko Social Network", never "KOKO". */

export const site = {
  name: "Oscar Mairey",
  url: "https://oscarmairey.com",
  email: "o@mairey.net",
  description:
    "Oscar Mairey builds the technology infrastructure of ARTE One, an AI-native hedge fund based in Dubai. Previously at Chainraizer, Ta-da, and Le Crypto Daily.",
  ogDescription:
    "Algorithmic asset manager at ARTE One. Builds the software behind the funds and products he works on.",
  /** The home page is an index, so the bio is two sentences. The record it
   *  used to carry — Chainraizer, Ta-da, Le Crypto Daily, the dates — lives
   *  on /companies. First person, like the book notes: the masthead directly
   *  above already says the name. `description` and
   *  `ogDescription` stay third-person and longer on purpose — they are the
   *  citation surface for search and answer engines, not the page. */
  bio: "I build the technology infrastructure of ARTE One, an AI-native hedge fund in Dubai. I've been in crypto since 2020 and shipping code since 2021.",
  links: [
    { label: "GitHub", href: "https://github.com/oscarmairey" },
    { label: "X", href: "https://x.com/oscarmairey" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/oscarmairey/" },
  ],
} as const;

/** The three lists, in the order the masthead prints them. The words and the
 *  routes come from src/lib/labels.tsx, so the nav cannot drift from them. */
export const nav = sectionList.map((spec) => ({ label: spec.plural, href: spec.route }));
