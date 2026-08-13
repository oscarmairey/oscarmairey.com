import { query } from "@/lib/db";

/** Everything the public site reads, and the reason it survives a dead database.
 *
 *  Each list is fetched at most once every TTL and kept in memory for the life
 *  of the process. When Postgres is unreachable the last good answer is served
 *  instead; if there has never been one, the caller gets an empty list and the
 *  page renders as an empty page. The public site never throws on a read, so a
 *  stopped database container costs freshness, not availability. */

export type Writing = {
  slug: string;
  title: string;
  subtitle: string;
  /** ISO day in UTC — what <time>, the feed and the sitemap use. */
  date: string;
  readingTime: string;
  body: string;
};

export type Book = {
  id: number;
  title: string;
  author: string;
  year: string;
  note: string;
};

const TTL = 30_000;

type Entry<T> = { value: T; at: number };
type Cell<T> = { entry?: Entry<T> };

const globalForContent = globalThis as unknown as {
  __omContent?: { writings: Cell<Writing[]>; books: Cell<Book[]> };
};

const cells = (globalForContent.__omContent ??= { writings: {}, books: {} });

async function read<T>(cell: Cell<T>, label: string, load: () => Promise<T>, empty: T): Promise<T> {
  const hit = cell.entry;
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  try {
    const value = await load();
    cell.entry = { value, at: Date.now() };
    return value;
  } catch (error) {
    console.error(`[content] ${label} unavailable: ${(error as Error).message}`);
    return hit ? hit.value : empty;
  }
}

/** Called after every write in the editor so a publish is visible at once. */
export function invalidateContent() {
  cells.writings.entry = undefined;
  cells.books.entry = undefined;
}

export function publishedWritings(): Promise<Writing[]> {
  return read(
    cells.writings,
    "writings",
    () =>
      query<Writing>(`
        SELECT slug,
               title,
               subtitle,
               body,
               reading_time AS "readingTime",
               to_char(COALESCE(published_at, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date
        FROM writings
        WHERE published
        ORDER BY COALESCE(published_at, created_at) DESC, id DESC
      `),
    [],
  );
}

export async function publishedWriting(slug: string): Promise<Writing | undefined> {
  const all = await publishedWritings();
  return all.find((w) => w.slug === slug);
}

export function publicBooks(): Promise<Book[]> {
  return read(
    cells.books,
    "books",
    () =>
      query<Book>(`
        SELECT id::int AS id, title, author, COALESCE(year_read, '') AS year, note
        FROM books
        ORDER BY sort_order, created_at, id
      `),
    [],
  );
}
