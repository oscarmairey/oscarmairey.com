import { query } from "@/lib/db";
import type { Item, Label, Section } from "@/lib/labels";
import { sections } from "@/lib/labels";

/** Everything the public site reads, and the reason it survives a dead database.
 *
 *  Each list is fetched at most once every TTL and kept in memory for the life
 *  of the process. When Postgres is unreachable the last good answer is served
 *  instead; if there has never been one, the caller gets an empty list and the
 *  page renders as an empty page. The public site never throws on a read, so a
 *  stopped database container costs freshness, not availability. */

const TTL = 30_000;

type Entry<T> = { value: T; at: number };
type Cell<T> = { entry?: Entry<T> };

const globalForContent = globalThis as unknown as {
  __omContent?: Record<string, Cell<unknown>>;
};

/** The store survives hot reloads, which means it can outlive the shape of the
 *  code that made it. So cells are created on demand, one key at a time, rather
 *  than as a single object literal: adding a list here never finds an older
 *  store missing the key. */
const store = (globalForContent.__omContent ??= {});

const cell = <T,>(name: string): Cell<T> => ((store[name] ??= {}) as Cell<T>);

async function read<T>(name: string, load: () => Promise<T>, empty: T): Promise<T> {
  const slot = cell<T>(name);
  const hit = slot.entry;
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  try {
    const value = await load();
    slot.entry = { value, at: Date.now() };
    return value;
  } catch (error) {
    console.error(`[content] ${name} unavailable: ${(error as Error).message}`);
    return hit ? hit.value : empty;
  }
}

/** Called after every write in the editor so a publish is visible at once. */
export function invalidateContent() {
  for (const slot of Object.values(store)) slot.entry = undefined;
}

const COLUMNS = `
  id::int AS id,
  label,
  slug,
  title,
  subtitle,
  byline,
  body,
  year,
  period,
  url,
  reading_time AS "readingTime",
  to_char(COALESCE(published_at, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date
`;

/** Notes read newest first. Books and companies read in the order Oscar set,
 *  which is why the first company is the current one. */
const orderFor = (label: Label) =>
  label === "note" ? "COALESCE(published_at, created_at) DESC, id DESC" : "sort_order, created_at, id";

/** Everything published under one label. Books and companies are written
 *  published, so this is the whole list for them and the live half for notes. */
export function published(section: Section): Promise<Item[]> {
  const { label } = sections[section];
  return read(
    section,
    () =>
      query<Item>(
        `SELECT ${COLUMNS} FROM writings WHERE label = $1 AND published ORDER BY ${orderFor(label)}`,
        [label],
      ),
    [],
  );
}

export async function publishedOne(section: Section, slug: string): Promise<Item | undefined> {
  const all = await published(section);
  return all.find((item) => item.slug === slug);
}
