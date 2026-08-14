"use client";

import { useEffect, useRef } from "react";
import type { Block } from "@/lib/blocks";
import { TOKEN } from "@/lib/inline";
import { imageSize, images, mediaUrl } from "@/lib/media";

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
    else if (m[4]) out += `<em>${escapeHtml(m[4])}</em>`;

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

export function Body({
  hostRef,
  blocks,
  onChange,
  onFiles,
}: {
  /** The editor keeps it: every formatting action is a DOM edit in here. */
  hostRef?: React.RefObject<HTMLDivElement | null>;
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  onFiles: (files: File[]) => void;
}) {
  const own = useRef<HTMLDivElement>(null);
  const host = hostRef ?? own;

  /* Captured once, object and all. React compares this prop by identity, so a
     fresh { __html } literal — even one holding the very same string — would
     rewrite the host on every render and throw away whatever has just been
     typed into it. */
  const initial = useRef({ __html: bodyHtml(blocks) });

  const read = () => host.current && onChange(blocksFromDom(host.current));

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
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const dropped = images(event.dataTransfer.files);
        if (dropped.length === 0) return;
        event.preventDefault();
        onFiles(dropped);
      }}
      onPaste={(event) => {
        const pasted = images(event.clipboardData.files);
        if (pasted.length > 0) {
          event.preventDefault();
          onFiles(pasted);
          return;
        }
        /* Text, never somebody else's markup. execCommand keeps the browser's
           own undo stack, which nothing here could rebuild. */
        event.preventDefault();
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
      onKeyDown={(event: React.KeyboardEvent) => event.key === "Enter" && event.preventDefault()}
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
