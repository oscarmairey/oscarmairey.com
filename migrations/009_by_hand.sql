-- Ordering comes back to the hand that writes the site.
--
-- 006 took it away on the grounds that a date is an order and nobody should
-- have to keep a list in their head. That was true of the dates and untrue of
-- the record: the order a life reads in is not the order it happened in, and
-- Oscar is the only one who knows the difference. So a position, dragged.
--
-- Seeded from what each list shows today — notes by the day they were
-- published, everything else by the day it was made — so nothing moves on the
-- day this runs. Lower is higher up.

ALTER TABLE writings ADD COLUMN position integer NOT NULL DEFAULT 0;

UPDATE writings AS w
SET position = ordered.n
FROM (
  SELECT id,
         row_number() OVER (
           PARTITION BY label
           ORDER BY CASE WHEN label = 'note' THEN COALESCE(published_at, created_at) ELSE created_at END DESC,
                    id DESC
         ) AS n
  FROM writings
) AS ordered
WHERE w.id = ordered.id;

-- What every list reads now. The index that served the date ordering goes with
-- the ordering it served.
DROP INDEX IF EXISTS writings_recent_idx;
CREATE INDEX writings_order_idx ON writings (label, position, id);
