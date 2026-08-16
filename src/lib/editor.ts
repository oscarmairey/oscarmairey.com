import { COLUMNS as READ, LIVE, ORDER, invalidateContent } from "@/lib/content";
import { query, queryOne, transact } from "@/lib/db";
import type { Draft, Editing, Label, Row, Version } from "@/lib/labels";
import { sections } from "@/lib/labels";

/** Everything /admin reads and writes. Unlike src/lib/content.ts these throw:
 *  the editor must say plainly that the database is down rather than quietly
 *  show an old copy of a post that is about to be overwritten.
 *
 *  One table, so one set of functions. What a label does differently is in
 *  src/lib/labels.tsx, not here.
 *
 *  Two tables now, and the seam between them is the whole feature: `writings`
 *  is the entry — its label, its address, whether a reader can reach it, when it
 *  went up, where it sits in its list — and `writings_versions` is what it says.
 *  Everything below either reads the live version, because that is what a list
 *  shows, or reads the one being written, because that is what the editor is
 *  open on. Nothing reads both. */

/** What the public site reads, plus the two things only the editor cares about.
 *  Its date is the one actually stored, not the one a page falls back to. */
const COLUMNS = `${READ},
  w.published,
  COALESCE(to_char(w.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '') AS date
`;

/** An entry with nothing written in it: what publishing, deleting and the
 *  address are about, none of which is a version's business. */
export type Entry = {
  id: number;
  slug: string;
  published: boolean;
  date: string;
  liveVersionId: number;
};

const ENTRY = `
  id::int AS id,
  slug,
  published,
  COALESCE(to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '') AS date,
  live_version_id::int AS "liveVersionId"
`;

/** One version, whole. The columns are the ones a page prints and no others. */
const CONTENT = `
  id::int AS id,
  n::int AS n,
  name,
  title,
  subtitle,
  byline,
  body,
  period,
  reading_time AS "readingTime"
`;

type VersionRow = Version & {
  title: string;
  subtitle: string;
  byline: string;
  body: string;
  period: string;
  readingTime: string;
};

/* ---- reading ------------------------------------------------------------- */

/** The same order the site reads, drafts sitting among the published in the
 *  place Oscar put them, each showing the version a reader would get. */
export function listItems(label: Label): Promise<Row[]> {
  return query<Row>(`SELECT ${COLUMNS} ${LIVE} WHERE w.label = $1 ORDER BY ${ORDER}`, [label]);
}

/** An entry opened at one of its versions: the live one, or the numbered one
 *  the address asks for.
 *
 *  Two statements, and the second brings every version's text with it. An entry
 *  has a handful of versions and one of them is about to be printed anyway; the
 *  alternative is a third round trip to learn what the second already knew. A
 *  number nobody wrote — a stale link, a version since gone — falls back to the
 *  live one rather than to a page that does not exist. */
export async function openBySlug(
  label: Label,
  slug: string,
  n: number | null,
): Promise<Editing | undefined> {
  const entry = await queryOne<Entry>(
    `SELECT ${ENTRY} FROM writings WHERE label = $1 AND slug = $2`,
    [label, slug],
  );
  if (!entry) return undefined;

  const all = await query<VersionRow>(
    `SELECT ${CONTENT} FROM writings_versions WHERE entry_id = $1 ORDER BY n`,
    [entry.id],
  );

  const open =
    all.find((one) => one.n === n) ?? all.find((one) => one.id === entry.liveVersionId) ?? all[0];
  if (!open) return undefined;

  return {
    id: entry.id,
    slug: entry.slug,
    published: entry.published,
    date: entry.date,
    liveVersionId: entry.liveVersionId,
    versionId: open.id,
    versions: all.map(({ id, n: number, name }) => ({ id, n: number, name })),
    title: open.title,
    subtitle: open.subtitle,
    byline: open.byline,
    body: open.body,
    period: open.period,
    readingTime: open.readingTime,
  };
}

export function getEntry(label: Label, id: number): Promise<Entry | undefined> {
  return queryOne<Entry>(`SELECT ${ENTRY} FROM writings WHERE label = $1 AND id = $2`, [label, id]);
}

/** One version of one entry, which is also how a save checks that the version
 *  it was handed is that entry's to write to. */
export function getVersion(entryId: number, versionId: number): Promise<VersionRow | undefined> {
  return queryOne<VersionRow>(
    `SELECT ${CONTENT} FROM writings_versions WHERE entry_id = $1 AND id = $2`,
    [entryId, versionId],
  );
}

/* ---- writing ------------------------------------------------------------- */

/** What a version holds, in the order every statement below writes it. */
const content = (draft: Draft) => [
  draft.title,
  draft.subtitle,
  draft.byline,
  draft.body,
  draft.period,
  draft.readingTime,
];

/** Nothing is born on the site. Every label starts as a draft and is published
 *  by a press, which is also what freezes its address.
 *
 *  And it starts at the top of its list, which is where the newest thing
 *  usually belongs. Anywhere else is one drag away.
 *
 *  An entry and its first version point at each other, so this is three
 *  statements rather than one, and all three or none: an entry without a live
 *  version is invisible to every read there is, which is a worse thing to leave
 *  behind than an error. */
export async function createItem(
  slug: string,
  draft: Draft,
): Promise<{ id: number; versionId: number; n: number }> {
  const label = sections[draft.section].label;

  const made = await transact(async (client) => {
    const entry = await client.query<{ id: number }>(
      `INSERT INTO writings (label, slug, published_at, position)
       VALUES ($1, $2, NULLIF($3, '')::timestamptz,
               (SELECT COALESCE(MIN(position), 1) - 1 FROM writings WHERE label = $1))
       RETURNING id::int AS id`,
      [label, slug, draft.date],
    );
    const id = entry.rows[0].id;

    const version = await client.query<{ id: number }>(
      `INSERT INTO writings_versions
         (entry_id, n, title, subtitle, byline, body, period, reading_time)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
       RETURNING id::int AS id`,
      [id, ...content(draft)],
    );
    const versionId = version.rows[0].id;

    await client.query("UPDATE writings SET live_version_id = $2 WHERE id = $1", [id, versionId]);
    return { id, versionId };
  });

  invalidateContent();
  return { id: made.id, versionId: made.versionId, n: 1 };
}

/** A save writes one version and the one thing on the entry that is typed on
 *  the page beside it. The version is named rather than looked up, so a save
 *  that was composed before Oscar switched versions still lands where it was
 *  typed. */
export async function updateItem(
  id: number,
  versionId: number,
  slug: string,
  draft: Draft,
): Promise<void> {
  const label = sections[draft.section].label;

  await transact(async (client) => {
    await client.query(
      `UPDATE writings
       SET slug = $2, published_at = NULLIF($3, '')::timestamptz, updated_at = now()
       WHERE id = $1 AND label = $4`,
      [id, slug, draft.date, label],
    );
    await client.query(
      `UPDATE writings_versions
       SET title = $3, subtitle = $4, byline = $5, body = $6, period = $7, reading_time = $8,
           updated_at = now()
       WHERE id = $2 AND entry_id = $1`,
      [id, versionId, ...content(draft)],
    );
  });

  invalidateContent();
}

/** Another go at the same entry, copied from the one it is being written from.
 *  It does not become live by being made. */
export async function addVersion(entryId: number, from: number): Promise<Version | undefined> {
  /* Never reused: a version number is how Oscar refers to one, and the third
     thing he wrote is v3 whatever happened to the second. */
  const next = "(SELECT COALESCE(MAX(n), 0) + 1 FROM writings_versions WHERE entry_id = $1)";

  return queryOne<Version>(
    `INSERT INTO writings_versions
       (entry_id, n, title, subtitle, byline, body, period, reading_time)
     SELECT $1, ${next}, title, subtitle, byline, body, period, reading_time
     FROM writings_versions WHERE entry_id = $1 AND id = $2
     RETURNING id::int AS id, n::int AS n, name`,
    [entryId, from],
  );
}

/** What Oscar calls a version. Nothing reads it but the selector, so nothing
 *  public can go stale behind it and there is no cache to empty. */
export async function setVersionName(
  entryId: number,
  versionId: number,
  name: string,
): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `UPDATE writings_versions SET name = $3, updated_at = now()
     WHERE entry_id = $1 AND id = $2
     RETURNING id::int AS id`,
    [entryId, versionId, name],
  );
  return rows.length > 0;
}

/** One version, thrown away, and the entry left where it was.
 *
 *  Never the live one. The condition is in the statement rather than only in
 *  the editor that offers it: what a reader can reach must always have words
 *  behind it, and that is not a rule the browser gets to be the last word on.
 *  It also means an entry can never be reduced to nothing, since the only
 *  version an entry with one version has is the live one. */
export async function deleteVersion(entryId: number, versionId: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `DELETE FROM writings_versions AS v
     USING writings AS w
     WHERE w.id = v.entry_id AND v.entry_id = $1 AND v.id = $2 AND w.live_version_id <> v.id
     RETURNING v.id::int AS id`,
    [entryId, versionId],
  );
  return rows.length > 0;
}

/** Which version a reader gets. A press of its own, and the only thing that
 *  moves it: not saving, not publishing, not being the newest. */
export async function setLive(entryId: number, versionId: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `UPDATE writings AS w
     SET live_version_id = v.id, updated_at = now()
     FROM writings_versions AS v
     WHERE w.id = $1 AND v.id = $2 AND v.entry_id = w.id
     RETURNING w.id::int AS id`,
    [entryId, versionId],
  );
  invalidateContent();
  return rows.length > 0;
}

/** The address, moved. Only ever called for an entry no reader can reach: a
 *  published address does not move, and nothing here decides that. */
export async function setSlug(id: number, slug: string): Promise<void> {
  await query("UPDATE writings SET slug = $2, updated_at = now() WHERE id = $1", [id, slug]);
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

/* An entry is never deleted. Unpublishing takes it off the site and keeps it,
   and a version that is not the live one can be thrown away; there is nothing
   here that destroys an entry, so there is nothing to call by mistake. */

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

/** Whether anything still refers to a stored file — any version of any entry,
 *  live or not. A picture that only the version Oscar is not showing anybody
 *  refers to is still referred to, and stays. Names contain no wildcards by
 *  construction, so LIKE is looking for exactly what it is given. */
export async function bodyUses(name: string): Promise<boolean> {
  const row = await queryOne<{ found: number }>(
    "SELECT 1 AS found FROM writings_versions WHERE body LIKE '%' || $1 || '%' LIMIT 1",
    [name],
  );
  return row !== undefined;
}

/** The order of a whole list, written in one statement so it cannot be left
 *  half done. The ids arrive in the order they are to be read in. */
export async function reorder(label: Label, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await query(
    `UPDATE writings AS w
     SET position = given.n, updated_at = now()
     FROM (SELECT unnest($2::int[]) AS id, generate_subscripts($2::int[], 1) AS n) AS given
     WHERE w.id = given.id AND w.label = $1`,
    [label, ids],
  );
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

  /* /admin/<section>/new is a page, so no entry may answer to that address. */
  const taken = new Set(["new", ...rows.map((row) => row.slug)]);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Postgres' unique_violation, the only write error worth naming to the user. */
export function isSlugTaken(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}
