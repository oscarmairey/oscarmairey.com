-- An entry can be written more than once.
--
-- A note, a book or a company is a thing with an address, a place in its list
-- and a day it went up. What it *says* is a version of it, and there can be
-- several: a rewrite is not a new entry, and it is not an edit that destroys the
-- one before it either. Exactly one version is live, and the live one is the
-- only thing a reader ever sees — on the page, in the lists, in the feed, in the
-- map a machine reads. Which one that is, is Oscar's to say, and saying it is a
-- press of its own: not the newest, not the one last typed into.
--
-- So the row keeps what identifies the entry — its label, its address, whether
-- it is on the site, when it went up, where it sits in its list — and everything
-- that is written moves out into a version. Publishing is still the entry's, and
-- so is the address it freezes at.
--
-- Every entry that exists today becomes its own v1, and that v1 is live, so
-- nothing on the site changes on the day this runs.

CREATE TABLE writings_versions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id     bigint NOT NULL REFERENCES writings (id) ON DELETE CASCADE,
  -- v1, v2, v3: per entry, handed out in order and never handed out twice.
  n            integer NOT NULL CHECK (n > 0),
  title        text NOT NULL DEFAULT '',
  subtitle     text NOT NULL DEFAULT '',
  byline       text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  period       text NOT NULL DEFAULT '',
  -- Derived from this version's body, so two versions may disagree about it.
  reading_time text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Which also indexes an entry's versions in the order the editor lists them.
  CONSTRAINT writings_versions_entry_n_key UNIQUE (entry_id, n)
);

-- Nullable, and it has to be: an entry and its first version each point at the
-- other, so they are two inserts and one of them goes first. Both happen in one
-- transaction, and every read joins on this, so an entry caught without one is
-- absent rather than half-written.
ALTER TABLE writings ADD COLUMN live_version_id bigint REFERENCES writings_versions (id);

INSERT INTO writings_versions
  (entry_id, n, title, subtitle, byline, body, period, reading_time, created_at, updated_at)
SELECT id, 1, title, subtitle, byline, body, period, reading_time, created_at, updated_at
FROM writings
ORDER BY id;

UPDATE writings AS w
SET live_version_id = v.id
FROM writings_versions AS v
WHERE v.entry_id = w.id AND v.n = 1;

-- What is written now lives in exactly one place. Nothing is copied back: two
-- copies of a body is two answers to what an entry says.
ALTER TABLE writings
  DROP COLUMN title,
  DROP COLUMN subtitle,
  DROP COLUMN byline,
  DROP COLUMN body,
  DROP COLUMN period,
  DROP COLUMN reading_time;

COMMENT ON COLUMN writings.live_version_id IS
  'The one version a reader sees. Set by hand, never by recency.';
