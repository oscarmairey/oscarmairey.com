import { query, queryOne } from "@/lib/db";
import { invalidateContent } from "@/lib/content";

/** Everything /admin reads and writes. Unlike src/lib/content.ts these throw:
 *  the editor must say plainly that the database is down rather than quietly
 *  show an old copy of a post that is about to be overwritten. */

export type WritingRow = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  body: string;
  readingTime: string;
  published: boolean;
  /** ISO day in UTC, or "" when the post has never been dated. */
  date: string;
};

export type BookRow = {
  id: number;
  title: string;
  author: string;
  year: string;
  note: string;
  sortOrder: number;
};

export type WritingInput = {
  slug: string;
  title: string;
  subtitle: string;
  body: string;
  readingTime: string;
  date: string;
};

const WRITING_COLUMNS = `
  id::int AS id,
  slug,
  title,
  subtitle,
  body,
  reading_time AS "readingTime",
  published,
  COALESCE(to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '') AS date
`;

export function listWritings(): Promise<WritingRow[]> {
  return query<WritingRow>(`
    SELECT ${WRITING_COLUMNS}
    FROM writings
    ORDER BY COALESCE(published_at, updated_at) DESC, id DESC
  `);
}

export function getWriting(id: number): Promise<WritingRow | undefined> {
  return queryOne<WritingRow>(`SELECT ${WRITING_COLUMNS} FROM writings WHERE id = $1`, [id]);
}

export async function createWriting(input: WritingInput): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO writings (slug, title, subtitle, body, reading_time, published_at)
     VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::timestamptz)
     RETURNING id::int AS id`,
    [input.slug, input.title, input.subtitle, input.body, input.readingTime, input.date],
  );
  invalidateContent();
  return row!.id;
}

export async function updateWriting(id: number, input: WritingInput): Promise<void> {
  await query(
    `UPDATE writings
     SET slug = $2, title = $3, subtitle = $4, body = $5, reading_time = $6,
         published_at = NULLIF($7, '')::timestamptz, updated_at = now()
     WHERE id = $1`,
    [id, input.slug, input.title, input.subtitle, input.body, input.readingTime, input.date],
  );
  invalidateContent();
}

/** Publishing dates the post if it has never been dated, and leaves the date
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

export async function deleteWriting(id: number): Promise<void> {
  await query("DELETE FROM writings WHERE id = $1", [id]);
  invalidateContent();
}

export function listBooks(): Promise<BookRow[]> {
  return query<BookRow>(`
    SELECT id::int AS id, title, author, COALESCE(year_read, '') AS year, note,
           sort_order AS "sortOrder"
    FROM books
    ORDER BY sort_order, created_at, id
  `);
}

export async function createBook(input: Omit<BookRow, "id" | "sortOrder">): Promise<void> {
  await query(
    `INSERT INTO books (title, author, year_read, note, sort_order)
     VALUES ($1, $2, NULLIF($3, ''), $4,
             COALESCE((SELECT MAX(sort_order) + 1 FROM books), 1))`,
    [input.title, input.author, input.year, input.note],
  );
  invalidateContent();
}

export async function updateBook(id: number, input: Omit<BookRow, "id">): Promise<void> {
  await query(
    `UPDATE books
     SET title = $2, author = $3, year_read = NULLIF($4, ''), note = $5,
         sort_order = $6, updated_at = now()
     WHERE id = $1`,
    [id, input.title, input.author, input.year, input.note, input.sortOrder],
  );
  invalidateContent();
}

export async function deleteBook(id: number): Promise<void> {
  await query("DELETE FROM books WHERE id = $1", [id]);
  invalidateContent();
}

/** Postgres' unique_violation, the only write error worth naming to the user. */
export function isSlugTaken(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}
