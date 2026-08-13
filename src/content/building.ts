/** What Oscar is building, and what he built before.
 *
 *  ARTE One lives in `currently` and nowhere else: it is the current post, so
 *  it is not repeated as an entry in the record below. */

export const currently = {
  date: "August 2026",
  blocks: [
    "At ARTE One I build the firm's technology infrastructure and run algorithmic strategies. That is as specific as I can be in public: the firm is regulated, and I don't discuss positions, counterparties, or capital.",
    "On the side I'm building a glass-cockpit flight system for my father's Cessna 182.",
  ],
  /** The one line the home page shows for the current post. */
  summary: "I build the firm's technology infrastructure and run algorithmic strategies.",
  name: "ARTE One",
};

export type Company = {
  name: string;
  years: string;
  role: string;
  /** One line for the home page. */
  summary: string;
  /** Full entry for /building. */
  description: string;
  result?: string;
};

export const companies: Company[] = [
  {
    name: "Chainraizer",
    years: "2025",
    role: "Operations, and builder of the Raizer platform",
    summary: "Ran operations and built the Raizer platform and the smart contracts under it.",
    description:
      "Chainraizer tokenizes private equity shares. I ran the operational side of the company and built the product: the Raizer web application and the smart contracts under it, deployed on Base, with an OTC market, DAO governance, smart wallets and KYC. I was also the company's public face, at conferences and in front of institutions.",
    result:
      "The platform shipped at [raizer.fi](https://raizer.fi), and the codebase is public at [github.com/oscarmairey/app.raizer.fi](https://github.com/oscarmairey/app.raizer.fi). The team won a hackathon at ETHDenver in 2025.",
  },
  {
    name: "Ta-da",
    years: "2024–2025",
    role: "Head of Community, then sales",
    summary: "Took the community from France into eight countries, then moved into sales.",
    description:
      "Ta-da builds blockchain-backed datasets for AI training. I took its community from France into eight countries, then moved into sales.",
  },
  {
    name: "Ko Social Network",
    years: "2022–2024",
    role: "",
    summary: "A SocialFi app. It presented at CES in Las Vegas in January 2023.",
    description:
      "Ko Social Network was a SocialFi app. It raised around $1M and presented at CES in Las Vegas in January 2023.",
  },
  {
    name: "Le Crypto Daily",
    years: "2022–2024",
    role: "First employee, community and marketing",
    summary: "First employee at a French-language crypto media outlet, with equity.",
    description:
      "Le Crypto Daily was a French-language crypto media outlet, a podcast that became a newsletter. I joined as its first employee, with equity, and ran community and marketing. I sold my shares when I left, and the outlet has since shut down.",
  },
];

export const code =
  "Thirteen public repositories at [github.com/oscarmairey](https://github.com/oscarmairey), including the Raizer platform, [conversai](https://github.com/oscarmairey/conversai) (AI voice agents for customer support), [betroom](https://github.com/oscarmairey/betroom) (peer-to-peer prediction markets), and a Solidity contract from October 2021.";

export type Talk = {
  title: string;
  meta: string;
  note: string;
  href: string;
};

export const talks: Talk[] = [
  {
    title: "Spectre de décentralisation",
    meta: "DeFi France, Paris",
    note: '"The Decentralization Spectrum", DeFi France meetup.',
    href: "https://www.youtube.com/watch?v=jxSDvPDbFvk",
  },
];
