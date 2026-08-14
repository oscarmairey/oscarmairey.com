import type { ReactNode } from "react";
import Link from "next/link";
import Prose from "@/components/site/prose";
import { parseBody } from "@/lib/blocks";
import { inline } from "@/lib/inline";
import type { EditField, Item, Section } from "@/lib/labels";
import { sections } from "@/lib/labels";

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
  list = [],
  slots,
}: {
  section: Section;
  item: Item;
  /** The whole list this entry belongs to, in the order the list prints it,
   *  which is the order the page reads its neighbours from. */
  list?: Item[];
  /** The editor hands in the text regions as editable ones, so the page it
   *  edits and the page it publishes are the same file. `edit` is how the
   *  stamp gets its own editable parts. */
  slots?: { title: ReactNode; sub: ReactNode; body: ReactNode; edit: EditField };
}) {
  const spec = sections[section];
  const blocks = parseBody(item.body);
  const stamp = spec.stamp(item, slots?.edit);

  /* Every list is newest first, so the entry after this one in it is the one
     that came before this one in life. The ends of the chain simply have one
     neighbour. */
  const at = list.findIndex((one) => one.slug === item.slug);
  const before = at === -1 ? undefined : list[at + 1];
  const after = at < 1 ? undefined : list[at - 1];

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

      {(before || after) && (
        <nav className="ends" aria-label={`Around this ${spec.one}`}>
          {before && (
            <p>
              <span className="when">Before:</span>
              <Link className="t" href={`${spec.route}/${before.slug}`}>
                {before.title}
              </Link>
            </p>
          )}
          {after && (
            <p>
              <span className="when">After:</span>
              <Link className="t" href={`${spec.route}/${after.slug}`}>
                {after.title}
              </Link>
            </p>
          )}
        </nav>
      )}
    </>
  );
}
