import { parseBody } from "@/lib/blocks";
import type { Item, Section } from "@/lib/labels";
import { sections } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";

/** The site, for a reader that is not a person.
 *
 *  The block format was always most of the way there: a paragraph is a
 *  paragraph, `## ` is a heading, `> ` is a quote, `* ` is a bullet,
 *  `[label](url)`, `**bold**` and `*italic*` are what markdown calls them, and
 *  a sidenote is already spelled the way markdown spells a footnote. So this
 *  changes four things and copies the rest: it makes image sources absolute,
 *  turns the one mark markdown has no syntax for into the tag it does have,
 *  keeps a typed line break as one, and moves the footnotes to the end where a
 *  footnote belongs. */

const inline = (text: string) =>
  text
    /* Markdown has no underline. The tag is honest and renders everywhere. */
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    /* A break inside a paragraph, in the way markdown writes one. */
    .replace(/\n/g, "  \n");

export function bodyMarkdown(body: string, base: string): string {
  const written: string[] = [];
  const footnotes: string[] = [];

  for (const block of parseBody(body)) {
    switch (block.kind) {
      case "h2":
        written.push(`## ${inline(block.text)}`);
        break;
      case "quote":
        written.push(
          block.source
            ? `> ${inline(block.text)}\n>\n> — ${inline(block.source)}`
            : `> ${inline(block.text)}`,
        );
        break;
      case "list":
        written.push(block.items.map((item) => `- ${inline(item)}`).join("\n"));
        break;
      case "image":
        written.push(`![${inline(block.text)}](${base}${mediaUrl(block.src)})`);
        break;
      case "note":
        footnotes.push(`[^${block.n}]: ${inline(block.text)}`);
        break;
      default:
        written.push(inline(block.text));
    }
  }

  if (footnotes.length > 0) written.push(footnotes.join("\n"));
  return written.join("\n\n");
}

/** What a label knows about an entry that the body does not say. Only what is
 *  actually there: an empty field is a field that does not appear. */
function facts(section: Section, item: Item, base: string): string[] {
  const url = `${base}${sections[section].route}/${item.slug}`;
  const out = [`- URL: ${url}`];

  if (section === "notes") {
    if (item.date) out.push(`- Published: ${item.date}`);
    if (item.readingTime) out.push(`- Reading time: ${item.readingTime}`);
  }
  if (section === "books" && item.byline) out.push(`- Author: ${item.byline}`);
  if (section === "companies") {
    if (item.period) out.push(`- Period: ${item.period}`);
    if (item.byline) out.push(`- Role: ${item.byline}`);
  }

  return out;
}

/** One entry, whole. */
export function entryMarkdown(section: Section, item: Item, base: string): string {
  const parts = [`# ${item.title}`];
  if (item.subtitle) parts.push(inline(item.subtitle));
  parts.push(facts(section, item, base).join("\n"));

  const body = bodyMarkdown(item.body, base);
  if (body) parts.push(body);

  return parts.join("\n\n") + "\n";
}

/** One line of a list: the title, where it lives, and what it is. */
export const entryLine = (section: Section, item: Item, base: string) =>
  `- [${item.title}](${base}${sections[section].route}/${item.slug})` +
  (item.subtitle ? `: ${item.subtitle}` : "");
