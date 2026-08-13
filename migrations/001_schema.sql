-- The two things the editor owns. Everything else on the site is still code.

CREATE TABLE writings (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text NOT NULL,
  subtitle     text NOT NULL DEFAULT '',
  -- The block format of src/lib/blocks.ts: paragraphs separated by a blank
  -- line, `## ` headings, `> ` quotes, `[^1]: ` sidenotes.
  body         text NOT NULL DEFAULT '',
  -- Free text, shown next to the date when set ("9 min"), hidden when empty.
  reading_time text NOT NULL DEFAULT '',
  published    boolean NOT NULL DEFAULT false,
  -- The date the site displays and sorts by. Set on first publish, then kept.
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX writings_published_idx ON writings (published, published_at DESC);

CREATE TABLE books (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      text NOT NULL,
  author     text NOT NULL DEFAULT '',
  -- Text, not an integer: the existing entries include "reread most years",
  -- and a book read across two winters has no year. Empty renders as nothing.
  year_read  text,
  note       text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX books_order_idx ON books (sort_order, created_at);
