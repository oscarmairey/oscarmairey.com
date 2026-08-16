import { site } from "@/content/site";
import { query, queryOne } from "@/lib/db";
import type { Item, Section } from "@/lib/labels";
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
  cachedBio = undefined;
}

/** Every column above the database reads, in the order the type declares them.
 *  The editor selects the same ones plus its own two: keeping the list here and
 *  extending it there is what stops the two drifting apart.
 *
 *  Half of them are the entry's and half are the version's, which is the whole
 *  point: an address and a place in a list belong to the thing, and everything
 *  that is written belongs to the draft of it that happens to be live. */
export const COLUMNS = `
  w.id::int AS id,
  w.slug,
  v.title,
  v.subtitle,
  v.byline,
  v.body,
  v.period,
  v.reading_time AS "readingTime"
`;

/** An entry and the one version of it anybody but Oscar can see. The join is an
 *  inner one on purpose: an entry that has somehow lost its live version is
 *  absent rather than rendered as a page with nothing on it. */
export const LIVE = `
  FROM writings AS w
  JOIN writings_versions AS v ON v.id = w.live_version_id
`;

/** The order Oscar dragged them into. Lower is higher up; a new entry starts at
 *  the top, where the newest thing usually belongs, and is moved from there. */
export const ORDER = "w.position, w.id";

/** The one line on the home page that is not an entry.
 *
 *  Cached and forgiving like the lists: the last good answer if the database
 *  stops answering, and the constant in src/content/site.ts if it never has.
 *  The home page always has a bio. */
let cachedBio: { value: string; at: number } | undefined;

export async function bio(): Promise<string> {
  try {
    if (cachedBio && Date.now() - cachedBio.at < TTL) return cachedBio.value;

    const row = await queryOne<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'bio'",
    );
    const value = row?.value?.trim() || site.bio;
    cachedBio = { value, at: Date.now() };
    return value;
  } catch (error) {
    console.error(`[content] bio unavailable: ${(error as Error).message}`);
    return cachedBio?.value ?? site.bio;
  }
}

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
              to_char(COALESCE(w.published_at, w.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date
       ${LIVE}
       WHERE w.label = $1 AND w.published ORDER BY ${ORDER}`,
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
