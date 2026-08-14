-- Housekeeping the four migrations before this one left behind.
--
-- `year` was a book's year_read. Nothing has printed it since a book became a
-- title and a reason, and nothing ever will: the column is empty in every row,
-- because the books arrived with a null year_read and no year was ever typed
-- after that. There is no data to keep, so the column goes.
--
-- `url` stays. It is empty for twelve rows and holds raizer.fi for the
-- thirteenth, which is the only copy of it left now that links live in the body
-- text; the column is read by nothing and costs nothing.

ALTER TABLE writings DROP COLUMN year;

COMMENT ON COLUMN writings.url IS
  'A company''s old link. Read by nothing: links belong in the body. Kept for the one row that has one.';

-- The table was built under a temporary name in 005 and renamed; its two CHECK
-- constraints kept the name it was born with.
ALTER TABLE writings RENAME CONSTRAINT content_unified_label_check TO writings_label_check;
ALTER TABLE writings RENAME CONSTRAINT content_unified_slug_check TO writings_slug_check;

-- And an index that cannot do the job it was made for: the public list of notes
-- orders by COALESCE(published_at, created_at), which a trailing published_at
-- key does not serve. Thirteen rows read faster sequentially than through any
-- of this. If the table ever grows into needing one, the honest shape is
--   (label, published, (COALESCE(published_at, created_at)) DESC)
-- and it can be added the day it earns its keep.
DROP INDEX writings_published_idx;
