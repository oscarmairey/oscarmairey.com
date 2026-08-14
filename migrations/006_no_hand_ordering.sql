-- Ordering by hand was a number in a form, and the form is gone: what a list
-- shows first is now simply what was made last. Notes already worked that way,
-- by the date they were published.
--
-- The order Oscar had set is not lost. The seeded books and companies all share
-- one created_at, from the single insert that made them, so before the column
-- goes it is spread back over that instant in the order it encoded: the row
-- that came first stays first.

UPDATE writings
SET created_at = created_at - (sort_order * interval '1 second')
WHERE label IN ('book', 'company');

DROP INDEX writings_order_idx;
ALTER TABLE writings DROP COLUMN sort_order;

CREATE INDEX writings_recent_idx ON writings (label, created_at DESC);

-- Two columns keep their contents and lose their readers. A book's year and a
-- company's link are no longer shown anywhere, and nothing selects them; they
-- stay because the data was Oscar's and dropping it is not this migration's
-- business.
COMMENT ON COLUMN writings.year IS 'Kept from the books table. Nothing reads it.';
COMMENT ON COLUMN writings.url IS 'Kept from the companies table. Nothing reads it: links belong in the body.';
