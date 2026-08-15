import { COLUMNS as READ, invalidateContent } from "@/lib/content";
import { query, queryOne } from "@/lib/db";
import type { Draft, Label, Row } from "@/lib/labels";
import { sections } from "@/lib/labels";

/** Everything /admin reads and writes. Unlike src/lib/content.ts these throw:
 *  the editor must say plainly that the database is down rather than quietly
 *  show an old copy of a post that is about to be overwritten.
 *
 *  One table, so one set of functions. What a label does differently is in
 *  src/lib/labels.tsx, not here. */

/** What the public site reads, plus the two things only the editor cares about.
 *  Its date is the one actually stored, not the one a page falls back to. */
const COLUMNS = `${READ},
  published,
  COALESCE(to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '') AS date
`;

/** The public order, with one difference: a draft has no publication date, and
 *  the useful thing about it here is when it was last touched. */
const orderFor = (label: Label) =>
  label === "note" ? "COALESCE(published_at, updated_at) DESC, id DESC" : "created_at DESC, id DESC";

export function listItems(label: Label): Promise<Row[]> {
  return query<Row>(
    `SELECT ${COLUMNS} FROM writings WHERE label = $1 ORDER BY ${orderFor(label)}`,
    [label],
  );
}

export function getBySlug(label: Label, slug: string): Promise<Row | undefined> {
  return queryOne<Row>(`SELECT ${COLUMNS} FROM writings WHERE label = $1 AND slug = $2`, [
    label,
    slug,
  ]);
}

export function getItem(label: Label, id: number): Promise<Row | undefined> {
  return queryOne<Row>(`SELECT ${COLUMNS} FROM writings WHERE label = $1 AND id = $2`, [label, id]);
}

/** The slug is not the draft's: it is derived on save and passed in beside it. */
const values = (slug: string, draft: Draft) => [
  sections[draft.section].label,
  slug,
  draft.title,
  draft.subtitle,
  draft.byline,
  draft.body,
  draft.period,
  draft.readingTime,
  draft.date,
];

/** Nothing is born on the site. Every label starts as a draft and is published
 *  by a press, which is also what freezes its address. */
export async function createItem(slug: string, draft: Draft): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO writings
       (label, slug, title, subtitle, byline, body, period, reading_time, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, '')::timestamptz)
     RETURNING id::int AS id`,
    values(slug, draft),
  );
  invalidateContent();
  return row!.id;
}

export async function updateItem(id: number, slug: string, draft: Draft): Promise<void> {
  const [label, ...rest] = values(slug, draft);
  await query(
    `UPDATE writings
     SET slug = $1, title = $2, subtitle = $3, byline = $4, body = $5, period = $6,
         reading_time = $7, published_at = NULLIF($8, '')::timestamptz, updated_at = now()
     WHERE id = $9 AND label = $10`,
    [...rest, id, label],
  );
  invalidateContent();
}

/** Publishing dates an entry that has never been dated, and leaves the date
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

/** The bio, as the editor reads and writes it. Unlike the public read this one
 *  throws: the editor must say plainly that the database is down. */
export async function getBio(): Promise<string> {
  const row = await queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'bio'");
  return row?.value ?? "";
}

export async function setBio(value: string): Promise<void> {
  await query(
    `INSERT INTO settings (key, value) VALUES ('bio', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [value],
  );
  invalidateContent();
}

/** Whether any entry still refers to a stored file. Names contain no wildcards
 *  by construction, so LIKE is looking for exactly what it is given. */
export async function bodyUses(name: string): Promise<boolean> {
  const row = await queryOne<{ found: number }>(
    "SELECT 1 AS found FROM writings WHERE body LIKE '%' || $1 || '%' LIMIT 1",
    [name],
  );
  return row !== undefined;
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

  /* /admin/<section>/new is a page, so no entry may answer to that address. */
  const taken = new Set(["new", ...rows.map((row) => row.slug)]);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Postgres' unique_violation, the only write error worth naming to the user. */
export function isSlugTaken(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}
