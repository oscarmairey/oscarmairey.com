import type { ReactNode } from "react";

/** Minimal inline formatter for content strings. Deliberately tiny: it exists so
 *  the content files stay plain JSON that a future editor can round-trip.
 *
 *    [label](https://url)   external or internal link
 *    *emphasis*             <em>
 *    [^1]                   sidenote marker
 *
 *  Anything else is rendered as text, so content can never inject markup. */

/** Exported so the editor can render the same tokens into a contenteditable
 *  region and read them back out. One regex, one syntax, two renderers. */
export const TOKEN = /\[\^(\d+)\]|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*/g;

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));

    if (m[1]) {
      out.push(
        <sup className="ref" key={key++} id={`ref-${m[1]}`}>
          {m[1]}
        </sup>,
      );
    } else if (m[2] && m[3]) {
      const href = m[3];
      const external = href.startsWith("http");
      out.push(
        <a
          key={key++}
          href={href}
          {...(external ? { rel: "noopener noreferrer" } : {})}
        >
          {m[2]}
        </a>,
      );
    } else if (m[4]) {
      out.push(<em key={key++}>{m[4]}</em>);
    }

    last = at + m[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The same string with all markup removed, for feeds and meta descriptions. */
export function plain(text: string): string {
  return text
    .replace(/\[\^\d+\]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}
