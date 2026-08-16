"use client";

import { useEffect, useRef } from "react";
import { lastNote, renumberNotes, serializeBlocks, type Block } from "@/lib/blocks";
import { TOKEN } from "@/lib/inline";
import { imageSize, images, mediaUrl } from "@/lib/media";
import { OWN, blocksFromHtml, carry } from "@/lib/paste";

/** The whole of the WYSIWYG machinery, in one file and no dependencies.
 *
 *  The body is one editing host, not one per block, because a reader selecting
 *  a sentence does not care where a paragraph ends and the browser cannot carry
 *  a selection across two of them. Inside it the browser does the editing it is
 *  good at — splitting paragraphs, joining them, breaking a line, dragging a
 *  selection down the page — and this file does the part it is bad at, which is
 *  saying what any of that means.
 *
 *  So nothing here writes the DOM while it is being typed in. React mounts the
 *  host once and never touches it again; every edit is the browser's; and after
 *  each one the DOM is read back into the block model of src/lib/blocks.ts. The
 *  stored format never changes, and the caret never moves under anybody's
 *  hands, because nothing moves it. */

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Source text to the markup the public page would render for it. */
export function inlineHtml(text: string): string {
  let out = "";
  let last = 0;

  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out += breaks(escapeHtml(text.slice(last, at)));

    if (m[1]) out += `<sup class="ref" data-ref="${m[1]}">${m[1]}</sup>`;
    else if (m[2] && m[3]) out += `<a href="${escapeHtml(m[3])}">${escapeHtml(m[2])}</a>`;
    else if (m[4]) out += `<strong>${escapeHtml(m[4])}</strong>`;
    else if (m[5]) out += `<u>${escapeHtml(m[5])}</u>`;
    else if (m[6]) out += `<em>${escapeHtml(m[6])}</em>`;

    last = at + m[0].length;
  }

  return out + breaks(escapeHtml(text.slice(last)));
}

/** A hard break inside a paragraph is a newline in the source and a <br> here. */
const breaks = (html: string) => html.replace(/\n/g, "<br>");

/* ---- the DOM, read back as source --------------------------------------- */

/** One run of text, with the three inline tokens put back the way they are
 *  stored. Anything the browser invented along the way — a styled span, a bold
 *  from a keyboard shortcut, a pasted class — is walked through and dropped:
 *  what survives is what the format can hold. */
function inlineOf(node: Node, skip?: (el: HTMLElement) => boolean): string {
  let out = "";

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.nodeValue ?? "";
      continue;
    }
    if (!(child instanceof HTMLElement) || skip?.(child)) continue;

    switch (child.tagName) {
      case "BR":
        out += "\n";
        break;
      case "SUP":
        out += child.dataset.ref ? `[^${child.dataset.ref}]` : inlineOf(child, skip);
        break;
      case "A": {
        const label = inlineOf(child, skip).trim();
        const href = child.getAttribute("href") ?? "";
        out += label && href ? `[${label}](${href})` : label;
        break;
      }
      case "EM":
      case "I": {
        const inner = inlineOf(child, skip);
        out += inner.trim() ? `*${inner.trim()}*` : inner;
        break;
      }
      case "STRONG":
      case "B": {
        const inner = inlineOf(child, skip);
        out += inner.trim() ? `**${inner.trim()}**` : inner;
        break;
      }
      case "U": {
        const inner = inlineOf(child, skip);
        out += inner.trim() ? `__${inner.trim()}__` : inner;
        break;
      }
      default:
        out += inlineOf(child, skip);
    }
  }

  return out.replace(/ /g, " ");
}

/** A heading, a quote and a sidenote are one line of prose however they were
 *  typed; only a paragraph keeps the breaks put in it on purpose. */
const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
const keepBreaks = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

const isNote = (el: HTMLElement) => el.classList.contains("sn");

/** Blocks that are one line by definition: the format collapses whatever is
 *  typed into them onto a single line, so a break inside one is a break that
 *  will not survive being saved. */
const ONE_LINE = new Set(["H2", "FIGCAPTION", "BLOCKQUOTE"]);

/** Enter at the end of a heading starts a paragraph under it, not another
 *  heading — a heading ends where it ends. Mid-heading it splits, and what was
 *  after the caret becomes that paragraph. A caption and a quote behave the
 *  same way, for the same reason: they are single lines too.
 *
 *  Shift+Enter in any of them does nothing at all. A line break there would be
 *  collapsed away the moment it was saved, and a key that appears to work and
 *  does not is worse than one that does nothing.
 *
 *  Everywhere else — a paragraph, a bullet — the browser is asked for the two
 *  behaviours by name, because insertParagraph is also what makes the next
 *  bullet and what leaves the list when the bullet it is on is empty. */
/** A paragraph becomes a one-item list, keeping whatever was in it. */
export function listFrom(block: HTMLElement): HTMLUListElement {
  const ul = document.createElement("ul");
  const li = document.createElement("li");
  li.append(...Array.from(block.childNodes));
  if (!li.textContent?.trim()) li.innerHTML = "<br>";
  ul.append(li);
  block.replaceWith(ul);
  return ul;
}

/** And back: one paragraph per bullet. */
export function listInto(ul: HTMLElement): HTMLElement[] {
  const paragraphs = Array.from(ul.querySelectorAll("li")).map((li) => {
    const p = document.createElement("p");
    p.append(...Array.from(li.childNodes));
    if (!p.textContent?.trim()) p.innerHTML = "<br>";
    return p;
  });
  ul.replaceWith(...paragraphs);
  return paragraphs;
}

export function caretInto(el: HTMLElement, atEnd = false) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(!atEnd);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function onEnter(host: HTMLElement, shift: boolean) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const node = selection.anchorNode;
  let el = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  if (!el || !host.contains(el)) return;

  let block: HTMLElement = el;
  const figure = el.closest("figure");
  if (figure) block = figure;
  else while (block.parentElement && block.parentElement !== host) block = block.parentElement;

  /* A bullet: Enter makes the next one, and an empty one leaves the list. The
     browser's own list command was doing neither reliably — it nested the list
     inside the paragraph it came from and pulled the paragraph after it in — so
     the list is built and unbuilt here, like everything else. */
  if (block.tagName === "UL" || block.tagName === "OL") {
    const item = el.closest("li");
    if (!item) return;
    if (shift) return void document.execCommand("insertLineBreak");

    if (!item.textContent?.trim()) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      block.after(paragraph);
      item.remove();
      if (!block.querySelector("li")) block.remove();
      caretInto(paragraph);
      return;
    }

    const rest = document.createRange();
    const at = selection.getRangeAt(0);
    rest.setStart(at.endContainer, at.endOffset);
    rest.setEnd(item, item.childNodes.length);

    const next = document.createElement("li");
    next.append(rest.extractContents());
    if (!next.textContent?.trim()) next.innerHTML = "<br>";
    item.after(next);
    caretInto(next);
    return;
  }

  if (!ONE_LINE.has(block.tagName)) {
    document.execCommand(shift ? "insertLineBreak" : "insertParagraph");
    return;
  }
  if (shift) return;

  /* The line the caret is actually in: the heading itself, the caption, or one
     of the two paragraphs a quote is made of. */
  let line: HTMLElement = el;
  while (line.parentElement && line.parentElement !== block && line !== block) {
    line = line.parentElement;
  }
  if (line === block && block.tagName === "FIGURE") {
    line = block.querySelector("figcaption") ?? block;
  }

  const range = selection.getRangeAt(0);
  const tail = document.createRange();
  tail.setStart(range.endContainer, range.endOffset);
  tail.setEnd(line, line.childNodes.length);

  const paragraph = document.createElement("p");
  paragraph.append(tail.extractContents());
  /* A trailing break the browser was keeping the old line open with is not the
     new line's business. */
  while (
    paragraph.firstChild?.nodeName === "BR" ||
    (paragraph.firstChild?.nodeType === Node.TEXT_NODE && !paragraph.firstChild.nodeValue?.trim())
  ) {
    paragraph.firstChild.remove();
  }
  if (!paragraph.textContent?.trim()) paragraph.innerHTML = "<br>";
  block.after(paragraph);

  const put = document.createRange();
  put.setStart(paragraph, 0);
  put.collapse(true);
  selection.removeAllRanges();
  selection.addRange(put);
}

/** `* ` at the head of a paragraph is a bullet asking to be one. Taken at the
 *  moment the space is typed, and handed to the browser, which knows how to
 *  make a list and how to leave one when the last bullet is empty. */
export function autoList(host: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || selection.rangeCount === 0) return false;

  const node = selection.anchorNode;
  if (!node) return false;

  let block = node instanceof HTMLElement ? node : (node.parentElement ?? null);
  while (block && block.parentElement !== host) block = block.parentElement;
  if (!block || block.tagName !== "P") return false;

  /* Everything in the block up to the caret, however the browser has arranged
     it — a fresh paragraph holds a <br> the text is typed around, so asking
     whether the text node comes first is asking the wrong question. And the
     space that just ended the bullet is a non-breaking one: a browser keeps a
     trailing space visible by making it one. */
  const before = document.createRange();
  before.setStart(block, 0);
  before.setEnd(node, selection.anchorOffset);
  if (before.toString().replace(/\u00a0/g, " ") !== "* ") return false;

  before.deleteContents();
  caretInto(listFrom(block).querySelector("li") as HTMLElement);
  return true;
}

/** What is written in the host, as blocks. */
export function blocksFromDom(host: HTMLElement): Block[] {
  const out: Block[] = [];

  for (const el of Array.from(host.children)) {
    if (!(el instanceof HTMLElement)) continue;

    if (el.tagName === "FIGURE") {
      const src = el.querySelector("img")?.getAttribute("src") ?? "";
      const name = decodeURIComponent(src.replace(/^\/media\//, ""));
      const caption = el.querySelector("figcaption");
      if (name) out.push({ kind: "image", src: name, text: caption ? collapse(inlineOf(caption)) : "" });
      continue;
    }

    if (el.tagName === "UL" || el.tagName === "OL") {
      const items = Array.from(el.querySelectorAll("li"))
        .map((li) => collapse(inlineOf(li)))
        .filter(Boolean);
      if (items.length) out.push({ kind: "list", items });
      continue;
    }

    if (/^H[1-6]$/.test(el.tagName)) {
      const text = collapse(inlineOf(el));
      if (text) out.push({ kind: "h2", text });
      continue;
    }

    if (el.tagName === "BLOCKQUOTE") {
      const parts = Array.from(el.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
      const source = parts.find((p) => p.classList.contains("src"));
      const said = parts.filter((p) => p !== source);
      const text = collapse(said.length ? said.map((p) => inlineOf(p)).join(" ") : inlineOf(el));
      if (text) out.push({ kind: "quote", text, source: source ? collapse(inlineOf(source)) : "" });
      continue;
    }

    /* A paragraph, or whatever the browser left behind that is standing in for
       one. Its sidenote is a block of its own, straight after it, which is how
       the format holds it and how <Prose> reads it back. */
    const text = keepBreaks(inlineOf(el, isNote));
    const note = Array.from(el.querySelectorAll<HTMLElement>(".sn"))[0];
    if (text) out.push({ kind: "p", text });
    if (note) {
      const n = Number(note.querySelector(".n")?.textContent ?? "") || out.filter((b) => b.kind === "note").length + 1;
      const said = collapse(inlineOf(note, (child) => child.classList.contains("n")));
      if (said) out.push({ kind: "note", n, text: said });
    }
  }

  return out;
}

/* ---- what is selected, as blocks ----------------------------------------- */

/** The tags the host holds as blocks. Everything else at the top of a fragment
 *  is loose inline text that was standing in the middle of one. */
const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "UL", "OL", "FIGURE"]);

/** Text taken from the middle of a paragraph arrives without the paragraph, so
 *  each run of it is given one before the fragment is read. */
function loose(holder: HTMLElement) {
  let run: ChildNode[] = [];

  const wrap = () => {
    if (run.length === 0) return;
    const p = document.createElement("p");
    holder.insertBefore(p, run[0]);
    p.append(...run);
    run = [];
  };

  for (const node of Array.from(holder.childNodes)) {
    if (node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName)) wrap();
    else run.push(node);
  }
  wrap();
}

/** Whatever is selected inside the host, as blocks.
 *
 *  A selection inside one paragraph is one paragraph; one dragged across three
 *  is three, the ends half-empty exactly as they were dragged. cloneContents
 *  keeps the structure inside the range, so what comes back is already the
 *  shape blocksFromDom reads. */
export function blocksFromSelection(host: HTMLElement): Block[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return [];

  const range = selection.getRangeAt(0);
  if (!host.contains(range.commonAncestorContainer)) return [];

  const holder = document.createElement("div");
  holder.append(range.cloneContents());
  loose(holder);
  return blocksFromDom(holder);
}

/* ---- and written into it once ------------------------------------------- */

const noteHtml = (block: Extract<Block, { kind: "note" }>) =>
  `<span class="sn"><span class="n" contenteditable="false">${block.n}</span>${inlineHtml(block.text)}</span>`;

export const figureHtml = (block: Extract<Block, { kind: "image" }>) => {
  const size = imageSize(block.src);
  const box = size ? ` width="${size.width}" height="${size.height}"` : "";
  return (
    `<figure contenteditable="false"><img src="${mediaUrl(block.src)}" alt="${escapeHtml(block.text)}"${box}>` +
    `<figcaption contenteditable="true" data-placeholder="Caption">${inlineHtml(block.text)}</figcaption></figure>`
  );
};

/** The blocks as the page draws them, which is the markup the host starts from
 *  and the shape everything above reads back. A quote keeps its source line
 *  even when empty, so there is somewhere to type one. */
export function bodyHtml(blocks: Block[]): string {
  let out = "";

  blocks.forEach((block, i) => {
    switch (block.kind) {
      case "note":
        break;
      case "h2":
        out += `<h2>${inlineHtml(block.text)}</h2>`;
        break;
      case "quote":
        out += `<blockquote><p>${inlineHtml(block.text)}</p><p class="src">${inlineHtml(block.source)}</p></blockquote>`;
        break;
      case "image":
        out += figureHtml(block);
        break;
      case "list":
        out += `<ul>${block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join("")}</ul>`;
        break;
      default: {
        const next = blocks[i + 1];
        const note = next?.kind === "note" ? noteHtml(next) : "";
        out += `<p>${inlineHtml(block.text)}${note}</p>`;
      }
    }
  });

  return out || "<p><br></p>";
}

/* ---- the body ------------------------------------------------------------ */

/** What the four shortcuts do, which is what the menu does. Bold, italic and
 *  underline are the browser's own commands, so the selection and the undo
 *  stack survive them; the link asks the editor, because it has to ask for a
 *  URL first. */
const SHORTCUTS: Record<string, string> = { b: "bold", i: "italic", u: "underline" };

export function Body({
  hostRef,
  blocks,
  onChange,
  onFiles,
  onLink,
}: {
  /** The editor keeps it: every formatting action is a DOM edit in here. */
  hostRef?: React.RefObject<HTMLDivElement | null>;
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  onFiles: (files: File[]) => void;
  onLink: () => void;
}) {
  const own = useRef<HTMLDivElement>(null);
  const host = hostRef ?? own;

  /* Captured once, object and all. React compares this prop by identity, so a
     fresh { __html } literal — even one holding the very same string — would
     rewrite the host on every render and throw away whatever has just been
     typed into it. */
  const initial = useRef({ __html: bodyHtml(blocks) });

  const read = () => {
    if (!host.current) return;
    autoList(host.current);
    onChange(blocksFromDom(host.current));
  };

  /** Copying puts the writing on the clipboard twice: as the source it is
   *  stored as, which is also what a plain-text target should get, and as the
   *  markup a word processor or a mail client wants — with the source riding
   *  along inside it.
   *
   *  That second copy is the point. Pasting back into the editor, from another
   *  version or another entry, is then the same blocks it was rather than a
   *  reading of the markup they were drawn as: nothing is interpreted, so
   *  nothing can be lost. Headings, links, the three marks, quotes, lists and
   *  sidenotes all survive by construction rather than by effort. */
  function carrying(event: React.ClipboardEvent, cut: boolean) {
    if (!host.current) return;

    const blocks = blocksFromSelection(host.current);
    if (blocks.length === 0) return; // nothing this format has a word for

    const source = serializeBlocks(blocks);
    event.preventDefault();
    event.clipboardData.setData("text/plain", source);
    event.clipboardData.setData(
      "text/html",
      `<div ${OWN}="${carry(source)}">${bodyHtml(blocks)}</div>`,
    );

    if (cut) {
      document.execCommand("delete");
      read();
    }
  }

  /** Blocks, put in where the caret is.
   *
   *  A run of plain sentences lands inside the paragraph it is dropped into,
   *  because that is what pasting a phrase means. Anything with a shape of its
   *  own — a heading, a list, a quote, more than one paragraph — arrives as
   *  blocks, and the browser splits the paragraph around them, which is the one
   *  part of this it is genuinely good at. */
  function splice(blocks: Block[]) {
    if (!host.current) return;

    /* Sidenotes coming in are renumbered past the ones already here, or two
       ones arrive and the pairs cross. */
    const here = Array.from(host.current.querySelectorAll<HTMLElement>("sup.ref"))
      .map((sup) => Number(sup.dataset.ref ?? sup.textContent ?? 0))
      .filter((n) => n > 0);
    const ready = renumberNotes(blocks, Math.max(0, ...here));

    const only = ready.length === 1 && ready[0].kind === "p" ? ready[0] : null;
    document.execCommand("insertHTML", false, only ? inlineHtml(only.text) : bodyHtml(ready));
    read();
  }

  useEffect(() => {
    document.execCommand("defaultParagraphSeparator", false, "p");
  }, []);

  return (
    <div
      ref={host}
      className="prose"
      data-region="body"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline="true"
      aria-label="Body"
      onInput={read}
      onKeyDown={(event) => {
        if (!host.current) return;

        if (event.key === "Enter") {
          event.preventDefault();
          onEnter(host.current, event.shiftKey);
          read();
          return;
        }

        /* Cmd on a Mac, Ctrl everywhere else. Save is not ours: it belongs to
           the page and is caught above this. */
        if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
        const key = event.key.toLowerCase();

        if (key === "k") {
          event.preventDefault();
          onLink();
          return;
        }
        if (SHORTCUTS[key]) {
          event.preventDefault();
          document.execCommand(SHORTCUTS[key]);
          read();
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const dropped = images(event.dataTransfer.files);
        if (dropped.length === 0) return;
        event.preventDefault();
        onFiles(dropped);
      }}
      onCopy={(event) => carrying(event, false)}
      onCut={(event) => carrying(event, true)}
      onPaste={(event) => {
        const pasted = images(event.clipboardData.files);
        if (pasted.length > 0) {
          event.preventDefault();
          onFiles(pasted);
          return;
        }

        /* Never somebody else's markup: what arrives is read into this site's
           own blocks and written back out as this site's own markup, so no
           class, no style and no unknown element survives the journey.
           execCommand keeps the browser's own undo stack, which nothing here
           could rebuild. */
        event.preventDefault();

        const html = event.clipboardData.getData("text/html");
        const blocks = html ? blocksFromHtml(html) : [];
        if (blocks.length > 0) return splice(blocks);

        document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
      }}
      dangerouslySetInnerHTML={initial.current}
    />
  );
}

/* ---- and the single lines around it -------------------------------------- */

/** A title, the line under it, a company's period: one run of plain text, with
 *  no format to speak of. Same contract as the body — written once, read back
 *  on input — and Enter is not a thing that happens in a line. */
export function Region({
  as: Tag,
  className,
  source,
  placeholder,
  region,
  focus = false,
  onChange,
  onFocus,
}: {
  as: "span";
  className?: string;
  source: string;
  placeholder?: string;
  /** Names the region, for the suite and for anyone reading the DOM. */
  region?: string;
  focus?: boolean;
  onChange: (source: string) => void;
  onFocus?: () => void;
}) {
  const el = useRef<HTMLElement>(null);
  const initial = useRef({ __html: escapeHtml(source) });

  useEffect(() => {
    if (!focus || !el.current) return;
    el.current.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el.current);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    /* Mount only. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tag
      ref={el as React.RefObject<HTMLSpanElement>}
      className={className}
      data-region={region}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      onInput={(event: React.FormEvent<HTMLElement>) =>
        onChange((event.currentTarget.textContent ?? "").replace(/ /g, " "))
      }
      onFocus={() => onFocus?.()}
      onKeyDown={(event: React.KeyboardEvent) => {
        /* A title has no formatting to apply, so the shortcuts that would apply
           some are swallowed rather than left to the browser. */
        if (event.key === "Enter") event.preventDefault();
        if ((event.metaKey || event.ctrlKey) && "biuk".includes(event.key.toLowerCase())) {
          event.preventDefault();
        }
      }}
      onPaste={(event: React.ClipboardEvent) => {
        event.preventDefault();
        document.execCommand(
          "insertText",
          false,
          event.clipboardData.getData("text/plain").replace(/\s+/g, " "),
        );
      }}
      dangerouslySetInnerHTML={initial.current}
    />
  );
}
