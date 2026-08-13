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
 *    anything else        paragraph
 *
 *  Inline syntax inside any block — [label](url), *emphasis*, [^1] — is handled
 *  by src/lib/inline.tsx. Parsing is total: every string is valid, and the worst
 *  case for an unrecognised line is that it renders as a paragraph. */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "quote"; text: string; source: string }
  | { kind: "note"; n: number; text: string };

const NOTE = /^\[\^(\d+)\]:\s*/;
const SOURCE = /^—\s*/;

/** Soft line breaks inside a block are typing artefacts, not content. */
const unwrap = (lines: string[]) => lines.join(" ").replace(/\s+/g, " ").trim();

export function parseBody(body: string): Block[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Block => {
      const lines = chunk.split("\n");

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

      return { kind: "p", text: unwrap(lines) };
    });
}

/** The inverse, used to seed the database from the old content files and to keep
 *  the format honest: parse(serialize(blocks)) is blocks. */
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
        default:
          return block.text;
      }
    })
    .join("\n\n");
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
