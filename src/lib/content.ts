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

type Cached = { value: Item[]; at: number };

/** Three lists, keyed by section. On globalThis so a hot reload does not throw
 *  away what has already been read.
 *
 *  Under its own key, and checked: a reload swaps the code without restarting
 *  the process, so whatever is already parked on globalThis was put there by
 *  the version before this one. It once was a different shape, and the site
 *  went down calling a method it did not have. A new shape gets a new name, and
 *  anything that is not what this file expects is thrown away rather than
 *  trusted. */
const globalForContent = globalThis as unknown as { __omLists?: Map<Section, Cached> };
if (!(globalForContent.__omLists instanceof Map)) globalForContent.__omLists = new Map();
const store = globalForContent.__omLists;

/** Called after every write in the editor so a publish is visible at once. */
export function invalidateContent() {
  store.clear();
}

/** Every column above the database reads, in the order the type declares them.
 *  The editor selects the same ones plus its own two: keeping the list here and
 *  extending it there is what stops the two drifting apart. */
export const COLUMNS = `
  id::int AS id,
  slug,
  title,
  subtitle,
  byline,
  body,
  period,
  reading_time AS "readingTime"
`;

/** Newest first, everywhere. A note is dated by the day it was published and
 *  everything else by the day it was made. Nothing is ordered by hand. */
export const orderFor = (label: Label) =>
  label === "note" ? "COALESCE(published_at, created_at) DESC, id DESC" : "created_at DESC, id DESC";

/** Everything published under one label. Books and companies are written
 *  published, so this is the whole list for them and the live half for notes. */
export async function published(section: Section): Promise<Item[]> {
  let hit: Cached | undefined;

  /* Everything, the cache included: a public page has no business throwing. */
  try {
    hit = store.get(section);
    if (hit && Date.now() - hit.at < TTL) return hit.value;

    const { label } = sections[section];
    const value = await query<Item>(
      `SELECT ${COLUMNS},
              to_char(COALESCE(published_at, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date
       FROM writings WHERE label = $1 AND published ORDER BY ${orderFor(label)}`,
      [label],
    );
    store.set(section, { value, at: Date.now() });
    return value;
  } catch (error) {
    /* The last good answer, or an empty page. Never a five hundred. */
    console.error(`[content] ${section} unavailable: ${(error as Error).message}`);
    return hit ? hit.value : [];
  }
}

export async function publishedOne(section: Section, slug: string): Promise<Item | undefined> {
  const all = await published(section);
  return all.find((item) => item.slug === slug);
}
