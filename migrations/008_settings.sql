-- One line of the site that is not an entry: the bio on the home page. It has
-- no title, no date, no address of its own, and there is exactly one of it, so
-- it is not a row in `writings` — a fourth label would have to be carried by the
-- nav, the lists, the routes and the editor to hold one sentence.
--
-- A key and a value instead, which is the smallest thing that can hold it and
-- whatever else turns out to be like it.

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seeded with what src/content/site.ts has been serving, so nothing on the page
-- changes on the day this runs. That constant stays where it is and becomes the
-- fallback: what the home page prints when the database has never answered.
INSERT INTO settings (key, value) VALUES (
  'bio',
  'I build the technology infrastructure of ARTE One, an AI-native hedge fund in Dubai. I''ve been in crypto since 2020 and shipping code since 2021.'
);
