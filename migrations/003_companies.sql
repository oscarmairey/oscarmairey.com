-- The record of companies, so each one can have a page of its own rather than
-- a paragraph in a list. `body` is the same block format as writings.body.

CREATE TABLE companies (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       text NOT NULL,
  -- What Oscar did there. Empty renders as nothing.
  role       text NOT NULL DEFAULT '',
  -- Free text: "2024–2025", "Now". Never parsed, only shown.
  period     text NOT NULL DEFAULT '',
  -- The one line the home page and /building show in their lists.
  summary    text NOT NULL DEFAULT '',
  -- Long form for /building/[slug]. Empty is fine: the page then shows the
  -- role, the period and the summary, and stays a page rather than a stub.
  body       text NOT NULL DEFAULT '',
  url        text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX companies_order_idx ON companies (sort_order, id);
