/** The body of a writing is one text field, written in the same small format the
 *  editor types. It is the block model that used to live in src/content, spelled
 *  as plain text so a phone keyboard can produce it.
 *
 *  Blocks are separated by a blank line:
 *
 *    ## Heading           section heading
 *    > Quoted sentence    pull quote; a closing `> — Source` line names it
 *    > — Source
 *    [^1]: Note text      sidenote, floated beside the paragraph carrying [^1]
 *    ![Caption](name.png) an uploaded image, served from /media
 *    * One item           a bullet; consecutive lines are one list
 *    anything else        paragraph
 *
 *  Inline syntax inside any block — [label](url), *emphasis*, [^1] — is handled
 *  by src/lib/inline.tsx. Parsing is total: every string is valid, and the worst
 *  case for an unrecognised line is that it renders as a paragraph. */

import { plain } from "@/lib/inline";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "quote"; text: string; source: string }
  | { kind: "note"; n: number; text: string }
  /** `src` is the stored file name; `text` is the caption, and the alt text. */
  | { kind: "image"; src: string; text: string }
  | { kind: "list"; items: string[] };

const NOTE = /^\[\^(\d+)\]:\s*/;
/** A bullet needs the space: `*emphasis*` has none and stays inline. */
const BULLET = /^\*[ \t]+/;
const IMAGE = /^!\[(.*)\]\(([^)]+)\)$/;
const SOURCE = /^—\s*/;

/** In a heading, a quote or a sidenote, a line break is a typing artefact and
 *  is collapsed. In a paragraph it is a break somebody asked for: blocks are
 *  separated by a blank line, so a single newline inside one is unambiguous,
 *  and src/lib/inline.tsx draws it as a <br>. */
const unwrap = (lines: string[]) => lines.join(" ").replace(/\s+/g, " ").trim();
const keep = (lines: string[]) =>
  lines
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, i, all) => line || (i > 0 && i < all.length - 1))
    .join("\n")
    .trim();

export function parseBody(body: string): Block[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Block => {
      const lines = chunk.split("\n");

      const image = unwrap(lines).match(IMAGE);
      if (image) return { kind: "image", src: image[2].trim(), text: image[1].trim() };

      if (BULLET.test(lines[0])) {
        return {
          kind: "list",
          items: lines
            .join("\n")
            .split(/\n(?=\*[ \t])/)
            .map((item) => unwrap(item.replace(BULLET, "").split("\n")))
            .filter(Boolean),
        };
      }

      if (lines[0].startsWith("## ")) {
        return { kind: "h2", text: unwrap([lines[0].slice(3), ...lines.slice(1)]) };
      }

      if (lines[0].startsWith(">")) {
        const inner = lines.map((l) => l.replace(/^>[ \t]?/, ""));
        let source = "";
        if (inner.length > 1 && SOURCE.test(inner[inner.length - 1])) {
          source = inner.pop()!.replace(SOURCE, "").trim();
        }
        return { kind: "quote", text: unwrap(inner), source };
      }

      const note = lines[0].match(NOTE);
      if (note) {
        return {
          kind: "note",
          n: Number(note[1]),
          text: unwrap([lines[0].replace(NOTE, ""), ...lines.slice(1)]),
        };
      }

      return { kind: "p", text: keep(lines) };
    });
}

/** The inverse, and what the editor saves through: parse(serialize(b)) is b. */
export function serializeBlocks(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "h2":
          return `## ${block.text}`;
        case "quote":
          return block.source ? `> ${block.text}\n> — ${block.source}` : `> ${block.text}`;
        case "note":
          return `[^${block.n}]: ${block.text}`;
        case "image":
          return `![${block.text}](${block.src})`;
        case "list":
          return block.items.map((item) => `* ${item}`).join("\n");
        default:
          return block.text;
      }
    })
    .join("\n\n");
}

/** Every image a body refers to, in the order it uses them. What the editor
 *  sweeps against when a body stops mentioning a file. */
export function imageNames(body: string): string[] {
  return parseBody(body).flatMap((block) => (block.kind === "image" ? [block.src] : []));
}

/** Words per minute for a reader who is actually reading. The number is only
 *  ever shown rounded to a minute, so it does not need to be defended. */
const WPM = 200;

/** The reading time the page prints, computed from the body at save time so it
 *  can never disagree with what is written. Empty body, empty string. */
export function readingTime(body: string): string {
  const words = plain(body.replace(/^\s*(##|>|\*[ \t]|\[\^\d+\]:)\s*/gm, ""))
    .split(/\s+/)
    .filter(Boolean).length;
  return words === 0 ? "" : `${Math.max(1, Math.round(words / WPM))} min`;
}

/** A slug from a title: what the editor proposes before Oscar overrides it.
 *  Matches the shape the database enforces. */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}
