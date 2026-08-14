-- Three tables that were the same table wearing three hats. A writing has a
-- title, a line under it and a body; so does a company, and so does a book. The
-- differences are four nullable columns, not three schemas.
--
-- So: one table, one `label`, one editor, one set of queries. The name stays
-- `writings` because that is what a row is, whatever it is about.
--
--   label      title      subtitle              byline   year   period   url
--   note       title      the angle             —        —      —        —
--   book       title      why it stayed         author   read   —        —
--   company    name       what the lists show   role     —      dates    site
--
-- `body` is the block format of src/lib/blocks.ts for every label. A row whose
-- body is empty shows its subtitle instead, which is how a company with nothing
-- written about it yet is still a page.

CREATE TABLE content_unified (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label        text NOT NULL CHECK (label IN ('note', 'book', 'company')),
  slug         text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text NOT NULL,
  -- The one line the lists print: a note's angle, a book's reason, a company's
  -- summary. Empty renders as nothing.
  subtitle     text NOT NULL DEFAULT '',
  -- Who wrote it or what Oscar did there: a book's author, a company's role.
  byline       text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  -- Text, not an integer: "reread most years" is a year read, and a book
  -- finished across two winters has none.
  year         text NOT NULL DEFAULT '',
  -- Free text: "2024-2025", "Now". Shown, never parsed.
  period       text NOT NULL DEFAULT '',
  url          text NOT NULL DEFAULT '',
  reading_time text NOT NULL DEFAULT '',
  -- Only a note is ever a draft. Books and companies are on the site the moment
  -- they exist, so they are written published and stay that way.
  published    boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Slugs live in one namespace per label, which is exactly one route each.
  CONSTRAINT content_unified_label_slug_key UNIQUE (label, slug)
);

/* ---- the writings, unchanged apart from the label ----------------------- */

INSERT INTO content_unified
  (label, slug, title, subtitle, body, reading_time, published, published_at,
   created_at, updated_at)
SELECT 'note', slug, title, subtitle, body, reading_time, published, published_at,
       created_at, updated_at
FROM writings
ORDER BY id;

/* ---- the companies ------------------------------------------------------ */

INSERT INTO content_unified
  (label, slug, title, subtitle, byline, body, period, url, published,
   sort_order, created_at, updated_at)
SELECT 'company', slug, name, summary, role, body, period, COALESCE(url, ''), true,
       sort_order, created_at, updated_at
FROM companies
ORDER BY sort_order, id;

/* ---- the books, which have never had a slug ----------------------------- */

-- The same slug src/lib/blocks.ts makes from a title: accents folded, lowercase,
-- runs of anything else collapsed to a hyphen, eighty characters. Two books that
-- reduce to the same string are numbered in the order the site already shows
-- them, and a title that reduces to nothing falls back to its row.

INSERT INTO content_unified
  (label, slug, title, subtitle, byline, year, published, sort_order,
   created_at, updated_at)
SELECT 'book',
       CASE WHEN n = 1 THEN base ELSE base || '-' || n END,
       title, note, author, COALESCE(year_read, ''), true, sort_order,
       created_at, updated_at
FROM (
  SELECT b.*,
         row_number() OVER (PARTITION BY b.base ORDER BY b.sort_order, b.id) AS n
  FROM (
    SELECT books.*,
           COALESCE(
             NULLIF(
               regexp_replace(
                 left(
                   regexp_replace(
                     lower(translate(
                       title,
                       'àáâãäåçèéêëìíîïñòóôõöøùúûüýÿšžœ',
                       'aaaaaaceeeeiiiinoooooouuuuyyszo'
                     )),
                     '[^a-z0-9]+', '-', 'g'
                   ),
                   80
                 ),
                 '^-|-$', '', 'g'
               ),
               ''
             ),
             'book-' || id
           ) AS base
    FROM books
  ) b
) numbered
ORDER BY sort_order, id;

/* ---- and now there is one ----------------------------------------------- */

DROP TABLE writings;
DROP TABLE books;
DROP TABLE companies;

ALTER TABLE content_unified RENAME TO writings;
ALTER INDEX content_unified_pkey RENAME TO writings_pkey;
ALTER INDEX content_unified_label_slug_key RENAME TO writings_label_slug_key;

-- What the public pages read: a label's published rows, newest first for notes.
CREATE INDEX writings_published_idx ON writings (label, published, published_at DESC);
-- What the ordered labels read: books and companies, in the order Oscar set.
CREATE INDEX writings_order_idx ON writings (label, sort_order, id);
