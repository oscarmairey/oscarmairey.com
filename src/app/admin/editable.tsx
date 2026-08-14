"use client";

import { useLayoutEffect, useRef } from "react";
import { TOKEN } from "@/lib/inline";

/** The whole of the WYSIWYG machinery, in one file and no dependencies.
 *
 *  A region is one editable run of text: a title, a subtitle, a paragraph, a
 *  heading, a quote, the line that names a quote, a sidenote. It is rendered
 *  with the classes the public page uses, so editing happens inside the page
 *  rather than beside it.
 *
 *  The storage format never changes: what a region holds is the same source
 *  text src/lib/blocks.ts parses, and the three inline tokens of
 *  src/lib/inline.tsx are rendered live and read back out.
 *
 *  React writes a region's content exactly once, on mount, and never touches it
 *  again — that is what keeps the caret from jumping while typing. When a
 *  structural edit does need to rewrite one, the parent changes its key and the
 *  region remounts with the caret put back where it belongs. */

const SKIP = "[data-skip]";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Source text to the markup the public page would render for it. */
export function inlineHtml(text: string): string {
  let out = "";
  let last = 0;

  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out += escapeHtml(text.slice(last, at));

    if (m[1]) out += `<sup class="ref" data-ref="${m[1]}">${m[1]}</sup>`;
    else if (m[2] && m[3]) out += `<a href="${escapeHtml(m[3])}">${escapeHtml(m[2])}</a>`;
    else if (m[4]) out += `<em>${escapeHtml(m[4])}</em>`;

    last = at + m[0].length;
  }

  return out + escapeHtml(text.slice(last));
}

/* ---- the DOM, read back as source --------------------------------------- */

type Scan = { out: string; done: boolean };
type Stop = { node: Node; offset: number } | null;

/** One walk serves both jobs: with no stop it serializes the whole region, and
 *  with one it measures how much source lies before a caret. */
function scan(node: Node, stop: Stop, state: Scan) {
  if (state.done) return;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? "";
    if (stop && node === stop.node) {
      state.out += text.slice(0, stop.offset);
      state.done = true;
    } else {
      state.out += text;
    }
    return;
  }

  if (!(node instanceof HTMLElement)) return;
  if (node.matches(SKIP)) return;

  const tag = node.tagName;

  if (tag === "BR") {
    state.out += " ";
    return;
  }
  if (tag === "SUP" && node.dataset.ref) {
    state.out += `[^${node.dataset.ref}]`;
    return;
  }

  /* A link and an emphasis are opened, walked into — the caret can be inside
     them — and closed only if the walk did not stop on the way. */
  if (tag === "A") {
    state.out += "[";
    children(node, stop, state);
    if (!state.done) state.out += `](${node.getAttribute("href") ?? ""})`;
    return;
  }
  if (tag === "EM" || tag === "I") {
    state.out += "*";
    children(node, stop, state);
    if (!state.done) state.out += "*";
    return;
  }

  children(node, stop, state);
}

function children(parent: Node, stop: Stop, state: Scan) {
  const kids = Array.from(parent.childNodes);
  const limit = stop && parent === stop.node ? stop.offset : kids.length;
  for (let i = 0; i < limit && !state.done; i++) scan(kids[i], stop, state);
  if (stop && parent === stop.node) state.done = true;
}

/** What a region holds, as source text. Non-breaking spaces are what a browser
 *  leaves behind when two spaces are typed; they are not content. */
export function readSource(root: HTMLElement): string {
  const state: Scan = { out: "", done: false };
  children(root, null, state);
  return state.out.replace(/\u00a0/g, " ");
}

/** Where a DOM position falls in that source text. */
export function sourceOffset(root: HTMLElement, node: Node, offset: number): number {
  const state: Scan = { out: "", done: false };
  children(root, { node, offset }, state);
  return state.out.length;
}

/** The selection inside a region, in source coordinates. */
export function selectionIn(root: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  return {
    start: sourceOffset(root, range.startContainer, range.startOffset),
    end: sourceOffset(root, range.endContainer, range.endOffset),
  };
}

/** The inverse: put the caret at a source offset. Offsets that land inside a
 *  token's punctuation settle on the nearest place a caret can actually go. */
export function placeCaret(root: HTMLElement, offset: number) {
  let count = 0;
  let target: Text | null = null;
  let at = 0;

  const walk = (parent: Node): boolean => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const length = (child.nodeValue ?? "").length;
        if (count + length >= offset) {
          target = child as Text;
          at = offset - count;
          return true;
        }
        count += length;
        continue;
      }

      if (!(child instanceof HTMLElement) || child.matches(SKIP)) continue;

      const tag = child.tagName;
      if (tag === "SUP" && child.dataset.ref) {
        count += child.dataset.ref.length + 3;
        continue;
      }
      if (tag === "A") {
        count += 1;
        if (walk(child)) return true;
        count += 3 + (child.getAttribute("href") ?? "").length;
        continue;
      }
      if (tag === "EM" || tag === "I") {
        count += 1;
        if (walk(child)) return true;
        count += 1;
        continue;
      }
      if (walk(child)) return true;
    }
    return false;
  };

  walk(root);

  const range = document.createRange();
  if (target) {
    range.setStart(target, Math.min(at, (target as Text).length));
  } else {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/* ---- the region ---------------------------------------------------------- */

export type Tag = "h1" | "h2" | "p" | "span" | "div";

export type RegionProps = {
  as: Tag;
  className?: string;
  /** The source text. Read on mount and never again: see the note above. */
  source: string;
  /** A title has no inline syntax, so it is typed and stored as it reads. */
  plain?: boolean;
  placeholder?: string;
  /** Names the region for the formatting menu: "<block id>:<part>". */
  region?: string;
  /** Where to put the caret when this region mounts, in source offsets. */
  caret?: number | null;
  onChange: (source: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>, el: HTMLElement) => void;
  onFocus?: (el: HTMLElement) => void;
};

export function Region({
  as: Tag,
  className,
  source,
  plain = false,
  placeholder,
  region,
  caret = null,
  onChange,
  onKeyDown,
  onFocus,
}: RegionProps) {
  const el = useRef<HTMLElement>(null);

  /* Captured once. The prop can change under us — it does on every keystroke,
     since it is our own text coming back around — and must not be written back
     into the DOM the reader is typing in. */
  const initial = useRef(plain ? escapeHtml(source) : inlineHtml(source));

  useLayoutEffect(() => {
    if (caret === null || !el.current) return;
    el.current.focus({ preventScroll: true });
    placeCaret(el.current, caret);
    /* Mount only: a remount is how a region is ever rewritten. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={el as any}
      className={className}
      data-region={region}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      onInput={(event) => onChange(readSource(event.currentTarget as HTMLElement))}
      onKeyDown={(event) => onKeyDown?.(event, event.currentTarget as HTMLElement)}
      onFocus={(event) => onFocus?.(event.currentTarget as HTMLElement)}
      onPaste={(event) => {
        /* Whatever was copied arrives as text, never as somebody else's markup. */
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        document.execCommand("insertText", false, text);
      }}
      dangerouslySetInnerHTML={{ __html: initial.current }}
    />
  );
}
