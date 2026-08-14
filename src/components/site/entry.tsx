import Link from "next/link";
import Entries from "@/components/site/entries";
import Prose from "@/components/site/prose";
import { parseBody } from "@/lib/blocks";
import { inline } from "@/lib/inline";
import type { Item, Section } from "@/lib/labels";
import { sections } from "@/lib/labels";

/** How much of the rest of a list a page ends with: enough to be a way on,
 *  short enough to stay a footnote to what was just read. */
const NEARBY = 4;

/** The one page on the site. A note, a book and a company are read the same
 *  way: the title, the line under it, a stamp of whatever metadata that label
 *  carries, then the body in the block format of src/lib/blocks.ts, sidenotes
 *  and all.
 *
 *  A row with nothing written in it yet is still a page: the one line becomes
 *  the body rather than being printed twice. */
export default function Entry({
  section,
  item,
  nearby = [],
}: {
  section: Section;
  item: Item;
  nearby?: Item[];
}) {
  const spec = sections[section];
  const blocks = parseBody(item.body);
  const stamp = spec.stamp(item);
  const rest = nearby.slice(0, NEARBY);

  return (
    <>
      <article>
        <h1 className="title">{item.title}</h1>
        {blocks.length > 0 && item.subtitle && <p className="sub">{item.subtitle}</p>}
        {stamp && <p className="stamp">{stamp}</p>}

        {blocks.length > 0 ? (
          <Prose blocks={blocks} />
        ) : (
          item.subtitle && (
            <div className="prose">
              <p>{inline(item.subtitle)}</p>
            </div>
          )
        )}

        {item.url && (
          <p className="stamp">
            <a href={item.url} rel="noopener noreferrer">
              {item.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </p>
        )}
      </article>

      {rest.length > 0 && (
        <section className="section">
          <h2>Nearby</h2>
          <Entries section={section} items={rest} tight />
          <Link className="more" href={spec.route}>
            All {spec.plural.toLowerCase()}
          </Link>
        </section>
      )}
    </>
  );
}
