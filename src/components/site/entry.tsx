import type { ReactNode } from "react";
import Link from "next/link";
import Entries from "@/components/site/entries";
import Prose from "@/components/site/prose";
import { parseBody } from "@/lib/blocks";
import { inline } from "@/lib/inline";
import type { EditField, Item, Section } from "@/lib/labels";
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
  slots,
}: {
  section: Section;
  item: Item;
  nearby?: Item[];
  /** The editor hands in the text regions as editable ones, so the page it
   *  edits and the page it publishes are the same file. `edit` is how the
   *  stamp gets its own editable parts. */
  slots?: { title: ReactNode; sub: ReactNode; body: ReactNode; edit: EditField };
}) {
  const spec = sections[section];
  const blocks = parseBody(item.body);
  const stamp = spec.stamp(item, slots?.edit);
  const rest = nearby.slice(0, NEARBY);

  /* Being edited: the line under the title is always there to be clicked, even
     when it is empty, and the record's own metadata is edited under the page
     rather than inside it. */
  if (slots) {
    return (
      <article>
        <h1 className="title">{slots.title}</h1>
        <p className="sub">{slots.sub}</p>
        {stamp && <p className="stamp">{stamp}</p>}
        <div className="prose">{slots.body}</div>
      </article>
    );
  }

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
