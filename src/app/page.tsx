import Entries from "@/components/site/entries";
import { bio, published } from "@/lib/content";
import type { Item, Section } from "@/lib/labels";
import { sections } from "@/lib/labels";

/** Rendered per request, on top of the cache in src/lib/content.ts: a publish
 *  from /admin is visible on the next load, and a database that is down costs
 *  freshness rather than the page. */
export const dynamic = "force-dynamic";

/** An index is titles and dates. Whatever a row has to say for itself it says
 *  on its own page, one click away, and the way to the whole list is where it
 *  has always been: in the masthead. */
const SHOWN = 5;

function Index({ section, items }: { section: Section; items: Item[] }) {
  const spec = sections[section];

  return (
    <section className="section">
      <h2>{spec.plural}</h2>
      <Entries section={section} items={items.slice(0, SHOWN)} tight />
    </section>
  );
}

export default async function Home() {
  const [line, notes, books, companies] = await Promise.all([
    bio(),
    published("notes"),
    published("books"),
    published("companies"),
  ]);

  return (
    <>
      <div className="lede">
        <p>{line}</p>
      </div>

      <Index section="notes" items={notes} />
      <Index section="books" items={books} />
      <Index section="companies" items={companies} />
    </>
  );
}
