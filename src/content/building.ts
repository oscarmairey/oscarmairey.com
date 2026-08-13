/** What is left of the record after the companies moved into the database:
 *  the two lists that are still code because they change once a year and have
 *  no editor behind them.
 *
 *  The companies themselves — ARTE One included — live in the `companies`
 *  table and are edited at /admin/companies. */

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
