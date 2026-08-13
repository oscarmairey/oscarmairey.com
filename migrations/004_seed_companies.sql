-- The record that lived in src/content/building.ts, moved into the database so
-- each company can have a page of its own. ARTE One led that file as
-- "Currently"; here it is simply the first row, which is what it always was.
--
-- `body` is the block format of src/lib/blocks.ts, the same one writings use.

INSERT INTO companies (slug, name, role, period, summary, body, url, sort_order) VALUES
(
  'arte-one',
  'ARTE One',
  'Technology infrastructure and algorithmic strategies',
  'Now',
  'I build the firm''s technology infrastructure and run algorithmic strategies.',
  'At ARTE One I build the firm''s technology infrastructure and run algorithmic strategies. That is as specific as I can be in public: the firm is regulated, and I don''t discuss positions, counterparties, or capital.

On the side I''m building a glass-cockpit flight system for my father''s Cessna 182.',
  NULL,
  0
),
(
  'chainraizer',
  'Chainraizer',
  'Operations, and builder of the Raizer platform',
  '2025',
  'Ran operations and built the Raizer platform and the smart contracts under it.',
  'Chainraizer tokenizes private equity shares. I ran the operational side of the company and built the product: the Raizer web application and the smart contracts under it, deployed on Base, with an OTC market, DAO governance, smart wallets and KYC. I was also the company''s public face, at conferences and in front of institutions.

The platform shipped at [raizer.fi](https://raizer.fi), and the codebase is public at [github.com/oscarmairey/app.raizer.fi](https://github.com/oscarmairey/app.raizer.fi). The team won a hackathon at ETHDenver in 2025.',
  'https://raizer.fi',
  1
),
(
  'ta-da',
  'Ta-da',
  'Head of Community, then sales',
  '2024–2025',
  'Took the community from France into eight countries, then moved into sales.',
  'Ta-da builds blockchain-backed datasets for AI training. I took its community from France into eight countries, then moved into sales.',
  NULL,
  2
),
(
  'ko-social-network',
  'Ko Social Network',
  '',
  '2022–2024',
  'A SocialFi app. It presented at CES in Las Vegas in January 2023.',
  'Ko Social Network was a SocialFi app. It raised around $1M and presented at CES in Las Vegas in January 2023.',
  NULL,
  3
),
(
  'le-crypto-daily',
  'Le Crypto Daily',
  'First employee, community and marketing',
  '2022–2024',
  'First employee at a French-language crypto media outlet, with equity.',
  'Le Crypto Daily was a French-language crypto media outlet, a podcast that became a newsletter. I joined as its first employee, with equity, and ran community and marketing. I sold my shares when I left, and the outlet has since shut down.',
  NULL,
  4
);
