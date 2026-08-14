import Link from "next/link";
import { inline } from "@/lib/inline";
import type { Item, Section } from "@/lib/labels";
import { sections } from "@/lib/labels";

/** The one list on the site. A note, a book and a company are printed by this
 *  component and nothing else: a title that leads to its own page, whatever
 *  metadata that label carries on the right, and the one line underneath.
 *
 *  `tight` drops the line underneath, which is what the home page wants: a
 *  title and a date, nothing else. */
export default function Entries({
  section,
  items,
  tight = false,
}: {
  section: Section;
  items: Item[];
  tight?: boolean;
}) {
  const spec = sections[section];

  return (
    <ul className={tight ? "rows tight" : "rows"}>
      {items.map((item) => {
        const meta = spec.meta(item);
        return (
          <li key={item.slug}>
            <p className="line">
              <Link className="t" href={`${spec.route}/${item.slug}`}>
                {item.title}
              </Link>
              {meta.text &&
                (meta.dateTime ? (
                  <time className="when" dateTime={meta.dateTime}>
                    {meta.text}
                  </time>
                ) : (
                  <span className="when">{meta.text}</span>
                ))}
            </p>
            {!tight && item.subtitle && <p className="note">{inline(item.subtitle)}</p>}
          </li>
        );
      })}
    </ul>
  );
}
