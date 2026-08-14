import { invalidateContent } from "@/lib/content";
import { query, queryOne } from "@/lib/db";
import type { Draft, Label, Row } from "@/lib/labels";
import { sections } from "@/lib/labels";

/** Everything /admin reads and writes. Unlike src/lib/content.ts these throw:
 *  the editor must say plainly that the database is down rather than quietly
 *  show an old copy of a post that is about to be overwritten.
 *
 *  One table, so one set of functions. What a label does differently is in
 *  src/lib/labels.tsx, not here. */

const COLUMNS = `
  id::int AS id,
  label,
  slug,
  title,
  subtitle,
  byline,
  body,
  period,
  reading_time AS "readingTime",
  published,
  COALESCE(to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '') AS date
`;

const orderFor = (label: Label) =>
  label === "note" ? "COALESCE(published_at, updated_at) DESC, id DESC" : "created_at DESC, id DESC";

export function listItems(label: Label): Promise<Row[]> {
  return query<Row>(
    `SELECT ${COLUMNS} FROM writings WHERE label = $1 ORDER BY ${orderFor(label)}`,
    [label],
  );
}

export function getItem(label: Label, id: number): Promise<Row | undefined> {
  return queryOne<Row>(`SELECT ${COLUMNS} FROM writings WHERE label = $1 AND id = $2`, [label, id]);
}

const values = (draft: Draft) => [
  sections[draft.section].label,
  draft.slug,
  draft.title,
  draft.subtitle,
  draft.byline,
  draft.body,
  draft.period,
  draft.readingTime,
  draft.date,
];

/** A label that has no draft state is written published: a book or a company is
 *  on the site the moment it exists, and there is nothing to stage. */
export async function createItem(draft: Draft): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO writings
       (label, slug, title, subtitle, byline, body, period, reading_time, published_at, published)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, '')::timestamptz, $1 <> 'note')
     RETURNING id::int AS id`,
    values(draft),
  );
  invalidateContent();
  return row!.id;
}

export async function updateItem(id: number, draft: Draft): Promise<void> {
  const [label, ...rest] = values(draft);
  await query(
    `UPDATE writings
     SET slug = $1, title = $2, subtitle = $3, byline = $4, body = $5, period = $6,
         reading_time = $7, published_at = NULLIF($8, '')::timestamptz, updated_at = now()
     WHERE id = $9 AND label = $10`,
    [...rest, id, label],
  );
  invalidateContent();
}

/** Publishing dates a note if it has never been dated, and leaves the date
 *  alone otherwise, so unpublishing and republishing does not move it. */
export async function setPublished(id: number, published: boolean): Promise<void> {
  await query(
    `UPDATE writings
     SET published = $2,
         published_at = CASE WHEN $2 THEN COALESCE(published_at, now()) ELSE published_at END,
         updated_at = now()
     WHERE id = $1`,
    [id, published],
  );
  invalidateContent();
}

export async function deleteItem(label: Label, id: number): Promise<void> {
  await query("DELETE FROM writings WHERE label = $1 AND id = $2", [label, id]);
  invalidateContent();
}

/** The first free slug in a label's namespace: the title's own, then the same
 *  with -2, -3 after it. Slugs are never typed, so a collision has to resolve
 *  itself rather than ask. */
export async function freeSlug(label: Label, base: string, keep: number | null): Promise<string> {
  const rows = await query<{ slug: string }>(
    `SELECT slug FROM writings
     WHERE label = $1 AND (slug = $2 OR slug LIKE $2 || '-%') AND ($3::int IS NULL OR id <> $3)`,
    [label, base, keep],
  );

  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Postgres' unique_violation, the only write error worth naming to the user. */
export function isSlugTaken(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}
