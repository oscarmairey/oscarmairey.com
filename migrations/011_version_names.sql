-- A version can be called something.
--
-- v1 and v2 are how the editor tells them apart and how the address finds one,
-- and that does not change: the number is the identity, handed out in order and
-- never handed out twice. But "v2" is not what Oscar is thinking when he keeps
-- two of them side by side. He is thinking "short pitch" and "long form", and a
-- list that will not say so is a list he has to remember instead of read.
--
-- So a name, optional, and worth nothing to anybody else: no reader ever sees
-- it, it is not in the feed, the map or the markdown, and it has no bearing on
-- which version is live. It is a label on a drawer.
--
-- Empty rather than null, like every other text column here: an unnamed version
-- is one whose name is nothing, and the selector falls back to its number.

ALTER TABLE writings_versions ADD COLUMN name text NOT NULL DEFAULT '';

COMMENT ON COLUMN writings_versions.name IS
  'What Oscar calls this version in the editor. Empty falls back to vN. Never public.';
