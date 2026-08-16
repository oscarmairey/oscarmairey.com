import { parseBody, type Block } from "@/lib/blocks";

/** Somebody else's HTML, read as the site's own small block model.
 *
 *  What arrives on a clipboard is a whole document's worth of markup: classes,
 *  styles, fonts, spans nested nine deep, and whatever the page it came from
 *  thought a paragraph was. None of it survives. This walks the fragment and
 *  writes the five block kinds and five inline marks the format has, and drops
 *  everything it has no word for — an unknown element is unwrapped to whatever
 *  text is inside it, so nothing is silently lost and nothing foreign is kept.
 *
 *  Two paths, and the first one is the one that matters. Text copied out of the
 *  editor carries its own source with it, so pasting it back is the same blocks
 *  it was, exactly; anything else is read like a stranger's. */

/* ---- the site's own writing, coming home --------------------------------- */

/** The attribute the copy handler in src/app/admin/editable.tsx writes, holding
 *  the block source itself. Percent-encoded, because a clipboard crosses an
 *  operating system on the way and an attribute holding raw newlines and quotes
 *  is asking to come back changed. */
export const OWN = "data-om-blocks";

export const carry = (source: string) => encodeURIComponent(source);

function carried(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    /* Mangled in transit, so it is not ours after all: read it as markup. */
    return "";
  }
}

/* ---- everybody else's ---------------------------------------------------- */

/** Never read, never rendered, never unwrapped: whatever is inside them is not
 *  writing. Images are here because an external one would have to be hotlinked
 *  or fetched to be kept, and neither is this editor's business — a picture is
 *  uploaded, from a file, and that path is untouched. */
const SKIP = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "HEAD", "META", "LINK", "TITLE", "BASE",
  "IMG", "PICTURE", "SOURCE", "SVG", "CANVAS", "VIDEO", "AUDIO",
  "IFRAME", "OBJECT", "EMBED", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "HR",
]);

/** Elements that hold blocks rather than being one. Walked into, and whatever
 *  loose text they carry becomes a paragraph of its own on either side. */
const GROUP = new Set([
  "DIV", "SECTION", "ARTICLE", "MAIN", "ASIDE", "HEADER", "FOOTER", "NAV",
  "FIGURE", "FIGCAPTION", "DL", "DD", "DT", "DETAILS", "SUMMARY",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH",
  "FORM", "FIELDSET", "ADDRESS", "CENTER", "BODY",
]);

const HEADING = /^H[1-6]$/;
const LIST = (el: HTMLElement) => el.tagName === "UL" || el.tagName === "OL";

/** What makes an element a container whatever its tag claims to be. */
const HOLDS_BLOCKS = "p,div,h1,h2,h3,h4,h5,h6,blockquote,ul,ol,pre,table,section,article,li";

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** A paragraph keeps the breaks somebody put in it on purpose, and nothing
 *  else: the format separates blocks by a blank line, so it has no room for
 *  one inside a block. */
const keepBreaks = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

/* ---- the five inline marks ----------------------------------------------- */

type Mark = "bold" | "italic" | "underline" | null;

const NUMBER = /^\d+$/;

/** What an element says it is, by its tag or by the one thing worth reading in
 *  its style attribute.
 *
 *  The style is read and thrown away, never carried: what comes out the other
 *  side is one of this site's own three marks or nothing. It is read at all
 *  because a word processor does not use <b> — it writes font-weight on a span,
 *  and it wraps the whole paste in a <b> that then turns itself off again. An
 *  explicit weight therefore beats the tag it is written on, in both
 *  directions. */
function markOf(el: HTMLElement): Mark {
  const style = el.getAttribute("style") ?? "";

  const weight = /font-weight:\s*([a-z]+|\d+)/i.exec(style)?.[1]?.toLowerCase();
  const bold = weight
    ? weight === "bold" || weight === "bolder" || Number(weight) >= 600
    : el.tagName === "B" || el.tagName === "STRONG";
  if (bold) return "bold";

  const slant = /font-style:\s*([a-z]+)/i.exec(style)?.[1]?.toLowerCase();
  const italic = slant ? slant === "italic" || slant === "oblique" : el.tagName === "I" || el.tagName === "EM";
  if (italic) return "italic";

  const line = /text-decoration(?:-line)?:\s*([^;]+)/i.exec(style)?.[1]?.toLowerCase();
  const under = line ? line.includes("underline") : el.tagName === "U" || el.tagName === "INS";
  return under ? "underline" : null;
}

/** The token, and the character that would stop it being one.
 *
 *  src/lib/inline.tsx is a flat tokeniser on purpose: **bold** holds anything
 *  but an asterisk, and the first alternative to match a position wins. So a
 *  mark is only written where it can be read back — never around text already
 *  carrying a marker, and never two deep. Text that cannot take one keeps its
 *  words and loses the mark, which is the right way round. */
const TOKENS = {
  bold: { mark: "**", breaks: /[*[]/ },
  italic: { mark: "*", breaks: /[*[]/ },
  underline: { mark: "__", breaks: /[_[]/ },
} as const;

function wrap(text: string, mark: Mark): string {
  if (!mark) return text;
  const { mark: token, breaks } = TOKENS[mark];

  const body = text.trim();
  if (!body || breaks.test(body)) return text;

  /* The spaces stay outside, or the marks read as text and not as marks. */
  const lead = text.slice(0, text.length - text.trimStart().length);
  const tail = text.slice(text.trimEnd().length);
  return `${lead}${token}${body}${token}${tail}`;
}

/** A link's address, or nothing. Only the schemes a reader could want, and
 *  never a closing bracket, which is where the token ends. */
function safeHref(href: string | null): string {
  const url = (href ?? "").trim();
  if (!url || url.includes(")") || /[\u0000-\u001f\u007f]/.test(url)) return "";
  return /^(?:https?:|mailto:|tel:|[/#])/i.test(url) ? url : "";
}

type Skip = (el: HTMLElement) => boolean;

/** One node, as source. `marked` says a mark is already open around it: the
 *  format cannot nest two, so the outermost one wins and the rest are dropped
 *  rather than written where they would be read as text. */
function one(node: Node, marked: boolean, skip?: Skip): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue ?? "").replace(/\s+/g, " ");
  if (!(node instanceof HTMLElement) || SKIP.has(node.tagName) || skip?.(node)) return "";

  if (node.tagName === "BR") return "\n";

  /* The site's own sidenote marker, so a copy off one of its pages keeps it. */
  if (node.tagName === "SUP" && node.classList.contains("ref")) {
    const n = node.dataset.ref ?? node.textContent?.trim() ?? "";
    return NUMBER.test(n) ? `[^${n}]` : "";
  }

  if (node.tagName === "A") {
    /* A label is plain text: the tokeniser reads up to the closing bracket and
       has no idea what a mark inside one would mean. */
    const label = collapse(inside(node, true, skip));
    const href = safeHref(node.getAttribute("href"));
    return label && href ? `[${label}](${href})` : label;
  }

  const mark = marked ? null : markOf(node);
  return wrap(inside(node, marked || mark !== null, skip), mark);
}

const inside = (node: Node, marked: boolean, skip?: Skip) =>
  Array.from(node.childNodes)
    .map((child) => one(child, marked, skip))
    .join("");

/* ---- and the five kinds of block ----------------------------------------- */

/** A list, flattened: the model has one level, so a list inside a list is more
 *  bullets rather than a shape it cannot draw. */
function bullets(el: HTMLElement): string[] {
  const items: string[] = [];

  for (const li of Array.from(el.children)) {
    if (!(li instanceof HTMLElement) || li.tagName !== "LI") continue;

    const text = collapse(inside(li, false, LIST));
    if (text) items.push(text);

    for (const child of Array.from(li.children)) {
      if (child instanceof HTMLElement && LIST(child)) items.push(...bullets(child));
    }
  }
  return items;
}

/** A paragraph, and the sidenote it carries if it is one of the site's own. */
function paragraph(el: HTMLElement, out: Block[]) {
  const note = el.querySelector<HTMLElement>(".sn");
  const text = keepBreaks(inside(el, false, (child) => child.classList.contains("sn")));
  if (text) out.push({ kind: "p", text });

  if (note) {
    const n = Number(note.querySelector(".n")?.textContent ?? "");
    const said = collapse(inside(note, false, (child) => child.classList.contains("n")));
    if (said) out.push({ kind: "note", n: n > 0 ? n : 1, text: said });
  }
}

/** A quote, and whoever is named at the end of it. */
function quote(el: HTMLElement, out: Block[]) {
  const named = el.querySelector<HTMLElement>("p.src, cite, footer");
  const text = collapse(inside(el, false, (child) => child === named));
  if (!text) return;

  const source = named ? collapse(inside(named, false)).replace(/^—\s*/, "") : "";
  out.push({ kind: "quote", text, source });
}

function fromDocument(doc: Document): Block[] {
  const out: Block[] = [];
  let run = "";

  const flush = () => {
    const text = keepBreaks(run);
    if (text) out.push({ kind: "p", text });
    run = "";
  };

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (!(child instanceof HTMLElement)) {
        run += one(child, false);
        continue;
      }
      if (SKIP.has(child.tagName)) continue;

      if (HEADING.test(child.tagName)) {
        flush();
        const text = collapse(inside(child, false));
        if (text) out.push({ kind: "h2", text });
        continue;
      }
      if (child.tagName === "P" || child.tagName === "PRE") {
        flush();
        paragraph(child, out);
        continue;
      }
      if (child.tagName === "BLOCKQUOTE") {
        flush();
        quote(child, out);
        continue;
      }
      if (LIST(child)) {
        flush();
        const items = bullets(child);
        if (items.length > 0) out.push({ kind: "list", items });
        continue;
      }
      if (GROUP.has(child.tagName)) {
        /* Loose text on either side of a group is its own paragraph: a page
           that writes its lines as divs means one line per div. */
        flush();
        walk(child);
        flush();
        continue;
      }

      /* An inline element with blocks inside it is not inline, whatever its
         tag says. A word processor wraps an entire document in a <b> that
         then turns its own weight off again, and reading that as one long
         bold paragraph is how a paste of ten pages arrives as one line. */
      if (child.querySelector(HOLDS_BLOCKS)) {
        flush();
        walk(child);
        flush();
        continue;
      }

      run += one(child, false);
    }
  };

  walk(doc.body);
  flush();
  return out;
}

/* ---- the way in ---------------------------------------------------------- */

/** Clipboard markup, as blocks. Empty when there is nothing in it this format
 *  has a word for, which is the caller's cue to fall back to plain text. */
export function blocksFromHtml(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, "text/html");

  /* The site's own writing, carried as the source it is stored as. Pasted back
     in, it is the blocks it was rather than a reading of the markup they were
     drawn as: nothing to lose, because nothing is being interpreted. */
  const source = carried(doc.querySelector(`[${OWN}]`)?.getAttribute(OWN) ?? null);
  if (source.trim()) return parseBody(source);

  return fromDocument(doc);
}
