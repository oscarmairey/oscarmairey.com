"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Entry from "@/components/site/entry";
import { parseBody, readingTime, serializeBlocks, type Block } from "@/lib/blocks";
import { itemOf, sections, type Draft } from "@/lib/labels";
import { deleteItem, saveItem, setItemPublished } from "./actions";
import { Region, selectionIn } from "./editable";

/** The editor is the page. There is no form and no preview: what is on screen
 *  is <Entry>, the component the public route mounts, with its title, its line
 *  under the title and its body handed in as editable regions. Type in the
 *  page, press Save, and the same markup is what a reader gets.
 *
 *  Everything the reader does not see — a book's author, a company's period,
 *  a note's date, the order, the publish state — is one quiet row underneath.
 *
 *  The slug and the reading time are not edited at all. Both are derived on the
 *  server at save time from the title and the body. */

type Props = { initial: Draft; live: boolean };

const AUTOSAVE_MS = 1500;

/** A block, plus an identity that survives editing and a version that only
 *  changes when the text has to be written back into the DOM. */
type Row = { id: number; v: number; block: Block };

type Part = "text" | "source" | "note";

type Caret = { key: string; at: number } | null;

type Menu = { x: number; y: number; row: number; part: Part; start: number; end: number } | null;

const rowsOf = (body: string, seed: { n: number }): Row[] => {
  const blocks = parseBody(body);
  if (blocks.length === 0) blocks.push({ kind: "p", text: "" });
  return blocks.map((block) => ({ id: seed.n++, v: 0, block }));
};

const key = (row: Row, part: Part) => `${row.id}:${part}:${row.v}`;
const region = (row: Row, part: Part) => `${row.id}:${part}`;

export default function Editor({ initial, live }: Props) {
  const router = useRouter();
  const spec = sections[initial.section];

  const seed = useRef({ n: 1 });
  const [draft, setDraft] = useState(initial);
  const [rows, setRows] = useState<Row[]>(() => rowsOf(initial.body, seed.current));
  const [published, setPublished] = useState(live);

  const [caret, setCaret] = useState<Caret>(initial.id === null ? { key: "title", at: 0 } : null);
  const [menu, setMenu] = useState<Menu>(null);
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  /* Nothing here works until React has taken the page over, and a Save button
     that quietly does nothing is worse than no button. Until this flips, the
     controls are visibly disabled and say so. */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const surface = useRef<HTMLDivElement>(null);
  const menuEl = useRef<HTMLDivElement>(null);

  const body = useMemo(() => serializeBlocks(rows.map((row) => row.block)), [rows]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  /* ---- what gets sent ---------------------------------------------------- */

  const sending: Draft = { ...draft, body, readingTime: readingTime(body) };

  const snapshot = JSON.stringify([
    sending.title,
    sending.subtitle,
    sending.body,
    sending.byline,
    sending.year,
    sending.period,
    sending.url,
    sending.date,
    sending.sortOrder,
  ]);

  const savedRef = useRef(snapshot);
  const sendingRef = useRef(sending);
  sendingRef.current = sending;

  const dirty = snapshot !== savedRef.current;

  async function persist(): Promise<number | null> {
    const payload = sendingRef.current;
    const sent = snapshot;

    setBusy(true);
    setError("");
    try {
      const result = await saveItem(payload);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      savedRef.current = sent;
      setSavedAt(new Date());
      setDraft((d) => ({ ...d, id: result.id, slug: result.slug }));
      if (payload.id === null) {
        window.history.replaceState(null, "", `/admin/${spec.section}/${result.id}`);
        router.refresh();
      }
      return result.id;
    } catch {
      setError("The save did not go through. Check the connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const persistRef = useRef(persist);
  persistRef.current = persist;

  /* A draft saves itself. Anything already on the site does not: an edit to
     something a reader can reach should take a deliberate press. */
  useEffect(() => {
    if (!spec.draftable || published) return;
    if (snapshot === savedRef.current) return;
    if (!sendingRef.current.title.trim()) return;

    const timer = setTimeout(() => void persistRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [snapshot, published, spec.draftable]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void persistRef.current();
      }
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ---- blocks ------------------------------------------------------------ */

  /** Every structural edit goes through here: it rewrites the rows, bumps the
   *  version of the ones whose text changed so they remount with it, and says
   *  where the caret should land. */
  function edit(next: Row[], put: Caret = null) {
    setRows(next);
    setCaret(put);
  }

  const bump = (row: Row, block: Block): Row => ({ id: row.id, v: row.v + 1, block });

  const textOf = (block: Block) => block.text;
  const withText = (block: Block, text: string): Block => ({ ...block, text });

  /** The three parts a block can carry text in, addressed the same way. */
  const partOf = (block: Block, part: Part) =>
    part === "source" && block.kind === "quote" ? block.source : block.text;

  const withPart = (block: Block, part: Part, value: string): Block =>
    part === "source" && block.kind === "quote"
      ? { ...block, source: value }
      : withText(block, value);

  /** A note belongs to the paragraph it follows, the way <Prose> reads it. */
  const noteAfter = (list: Row[], i: number) =>
    list[i + 1]?.block.kind === "note" ? i + 1 : -1;

  function change(i: number, part: Part, source: string) {
    setRows((list) =>
      list.map((row, at) => (at === i ? { ...row, block: withPart(row.block, part, source) } : row)),
    );
  }

  /** Enter: the block ends here and a paragraph starts. */
  function split(i: number, start: number, end: number) {
    const row = rows[i];
    const text = textOf(row.block);
    const head = text.slice(0, start);
    const tail = text.slice(end);

    const next = [...rows];
    next[i] = bump(row, withText(row.block, head));

    const fresh: Row = { id: seed.current.n++, v: 0, block: { kind: "p", text: tail } };
    const note = noteAfter(next, i);
    next.splice(note === -1 ? i + 1 : note + 1, 0, fresh);

    edit(next, { key: key(fresh, "text"), at: 0 });
  }

  /** Backspace at the very start: this block joins the one before it. */
  function mergeBack(i: number) {
    const row = rows[i];

    if (i === 0) {
      if (row.block.kind === "p") return;
      edit(
        rows.map((r, at) => (at === i ? bump(r, { kind: "p", text: textOf(r.block) }) : r)),
        { key: `${row.id}:text:${row.v + 1}`, at: 0 },
      );
      return;
    }

    let before = i - 1;
    while (before >= 0 && rows[before].block.kind === "note") before -= 1;
    if (before < 0) return;

    const target = rows[before];
    const joined = textOf(target.block) + textOf(row.block);
    const at = textOf(target.block).length;

    const next = rows.filter((_, index) => index !== i);
    const to = next.findIndex((r) => r.id === target.id);
    next[to] = bump(target, withText(target.block, joined));

    edit(next, { key: `${target.id}:text:${target.v + 1}`, at });
  }

  function onKeyDown(i: number, part: Part, event: React.KeyboardEvent<HTMLElement>, el: HTMLElement) {
    const selection = selectionIn(el);

    if (event.key === "Enter") {
      event.preventDefault();
      if (part !== "text" || rows[i].block.kind === "note") return;
      split(i, selection?.start ?? 0, selection?.end ?? 0);
      return;
    }

    if (event.key === "Backspace" && part === "text" && selection?.start === 0 && selection.end === 0) {
      event.preventDefault();
      mergeBack(i);
    }
  }

  /* ---- the menu ----------------------------------------------------------- */

  function open(x: number, y: number) {
    const selection = window.getSelection();
    const node = selection?.anchorNode ?? null;
    const el = (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>(
      "[data-region]",
    );
    if (!el || !surface.current?.contains(el)) return;

    const [id, part] = (el.dataset.region ?? "").split(":");
    const i = rows.findIndex((row) => String(row.id) === id);
    if (i === -1) return;

    const at = selectionIn(el) ?? { start: 0, end: 0 };
    setMenu({ x, y, row: i, part: part as Part, start: at.start, end: at.end });
  }

  function wrap(before: string, after: string) {
    if (!menu) return;
    const row = rows[menu.row];
    const text = partOf(row.block, menu.part);
    const chosen = text.slice(menu.start, menu.end);
    const next = text.slice(0, menu.start) + before + chosen + after + text.slice(menu.end);

    edit(
      rows.map((r, at) => (at === menu.row ? bump(r, withPart(r.block, menu.part, next)) : r)),
      {
        key: `${row.id}:${menu.part}:${row.v + 1}`,
        at: menu.start + before.length + chosen.length,
      },
    );
    setMenu(null);
  }

  function turn(kind: Block["kind"]) {
    if (!menu) return;
    const row = rows[menu.row];
    const text = textOf(row.block);
    const block: Block =
      row.block.kind === kind
        ? { kind: "p", text }
        : kind === "quote"
          ? { kind: "quote", text, source: "" }
          : { kind: "h2", text };

    edit(
      rows.map((r, at) => (at === menu.row ? bump(r, block) : r)),
      { key: `${row.id}:text:${row.v + 1}`, at: menu.start },
    );
    setMenu(null);
  }

  function sidenote() {
    if (!menu) return;
    const row = rows[menu.row];
    const n = Math.max(0, ...rows.map((r) => (r.block.kind === "note" ? r.block.n : 0))) + 1;
    const text = textOf(row.block);
    const marked = `${text.slice(0, menu.start)}[^${n}]${text.slice(menu.start)}`;

    const next = rows.map((r, at) => (at === menu.row ? bump(r, withText(r.block, marked)) : r));
    const note: Row = { id: seed.current.n++, v: 0, block: { kind: "note", n, text: "" } };
    next.splice(menu.row + 1, 0, note);

    edit(next, { key: key(note, "note"), at: 0 });
    setMenu(null);
  }

  function link() {
    const href = window.prompt("Link to");
    if (href) wrap("[", `](${href.trim()})`);
    else setMenu(null);
  }

  /* The touch path: no right button, so a selection offers the same menu. */
  useEffect(() => {
    const onSelect = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return setTouch(null);
      const range = selection.getRangeAt(0);
      if (!surface.current?.contains(range.commonAncestorContainer)) return setTouch(null);
      const box = range.getBoundingClientRect();
      setTouch({ x: box.right, y: box.top });
    };
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, []);

  useEffect(() => {
    if (!menu) return;

    /* A press inside the menu is the menu being used. Everything else closes
       it. Asking the element itself beats trying to stop the event: React
       listens on the document too, and neither of us can be sure who is
       first. */
    const close = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuEl.current?.contains(target)) return;
      setMenu(null);
    };

    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  /* ---- the rest ----------------------------------------------------------- */

  async function togglePublished(next: boolean) {
    const savedId = await persist();
    if (savedId === null) return;

    setBusy(true);
    const result = await setItemPublished(spec.section, savedId, next);
    setBusy(false);

    if (!result.ok) return setError(result.error);
    setPublished(next);
    setSavedAt(new Date());
    router.refresh();
  }

  async function remove() {
    if (draft.id === null) return router.push(`/admin/${spec.section}`);
    if (!window.confirm(`Delete “${draft.title || "Untitled"}”? This cannot be undone.`)) return;
    savedRef.current = snapshot; // stop the unload warning firing on the way out
    setBusy(true);
    await deleteItem(spec.section, draft.id);
  }

  const onSite = published || !spec.draftable;

  const status = !ready
    ? "Loading the editor…"
    : error
      ? error
      : busy
        ? "Saving…"
        : dirty
          ? "Unsaved"
          : savedAt
            ? `Saved at ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
            : draft.id === null
              ? "Not saved yet"
              : onSite
                ? "On the site"
                : "Draft";

  /* ---- the page ------------------------------------------------------------ */

  const at = (k: string) => (caret?.key === k ? caret.at : null);

  /* Keyed by the version, like every other block: a paragraph whose text was
     rewritten under it — split, joined, marked with a note — has to come back
     with the new text, and only a new key does that. */
  const paragraph = (row: Row, i: number, note: Row | undefined, first: boolean) => (
    <p key={key(row, "text")}>
      <Region
        as="span"
        source={row.block.text}
        region={region(row, "text")}
        placeholder={first ? "Write…" : undefined}
        caret={at(key(row, "text"))}
        onChange={(text) => change(i, "text", text)}
        onKeyDown={(event, el) => onKeyDown(i, "text", event, el)}
      />
      {note && note.block.kind === "note" && (
        <span className="sn" key={key(note, "note")}>
          <span className="n">{note.block.n}</span>
          <Region
            as="span"
            source={note.block.text}
            region={region(note, "note")}
            placeholder="The note"
            caret={at(key(note, "note"))}
            onChange={(text) => change(i + 1, "note", text)}
            onKeyDown={(event, el) => onKeyDown(i + 1, "note", event, el)}
          />
        </span>
      )}
    </p>
  );

  const blocks = rows.map((row, i) => {
    if (row.block.kind === "note") return null;

    if (row.block.kind === "h2") {
      return (
        <Region
          key={key(row, "text")}
          as="h2"
          source={row.block.text}
          region={region(row, "text")}
          placeholder="Heading"
          caret={at(key(row, "text"))}
          onChange={(text) => change(i, "text", text)}
          onKeyDown={(event, el) => onKeyDown(i, "text", event, el)}
        />
      );
    }

    if (row.block.kind === "quote") {
      return (
        <blockquote key={row.id}>
          <Region
            key={key(row, "text")}
            as="p"
            source={row.block.text}
            region={region(row, "text")}
            placeholder="The quotation"
            caret={at(key(row, "text"))}
            onChange={(text) => change(i, "text", text)}
            onKeyDown={(event, el) => onKeyDown(i, "text", event, el)}
          />
          <Region
            key={`${key(row, "source")}`}
            as="p"
            className="src"
            source={row.block.source}
            region={region(row, "source")}
            placeholder="Who said it"
            caret={at(key(row, "source"))}
            onChange={(text) => change(i, "source", text)}
            onKeyDown={(event, el) => onKeyDown(i, "source", event, el)}
          />
        </blockquote>
      );
    }

    const note = noteAfter(rows, i);
    return paragraph(row, i, note === -1 ? undefined : rows[note], i === 0);
  });

  /* A heading, a quote and a sidenote are what a block is; emphasis and a link
     are what a run of text is. So the first three are offered on a block's own
     text and the last two anywhere. */
  const current = menu?.part === "text" ? rows[menu.row]?.block.kind : undefined;
  const hasNote = menu ? noteAfter(rows, menu.row) !== -1 : false;

  return (
    <>
      <div
        ref={surface}
        className="adm-page"
        onContextMenu={(event) => {
          event.preventDefault();
          open(event.clientX, event.clientY);
        }}
      >
        <Entry
          section={spec.section}
          item={itemOf(sending)}
          slots={{
            title: (
              <Region
                as="span"
                plain
                source={draft.title}
                region="title"
                placeholder={spec.name}
                caret={at("title")}
                onChange={(title) => set({ title })}
                onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
              />
            ),
            sub: (
              <Region
                as="span"
                plain
                source={draft.subtitle}
                region="sub"
                placeholder={spec.sub}
                caret={at("sub")}
                onChange={(subtitle) => set({ subtitle })}
                onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
              />
            ),
            body: blocks,
          }}
        />
      </div>

      {touch && !menu && (
        <button
          className="adm-dots"
          type="button"
          style={{ left: touch.x, top: touch.y }}
          aria-label="Formatting"
          onMouseDown={(event) => event.preventDefault()}
          onTouchStart={(event) => event.preventDefault()}
          onClick={() => open(touch.x, touch.y)}
        >
          ⋯
        </button>
      )}

      {menu && (
        <div
          ref={menuEl}
          className="adm-menu"
          style={{ left: menu.x, top: menu.y }}
          /* Keeps the selection the menu is about to act on. */
          onMouseDown={(event) => event.preventDefault()}
        >
          {current && current !== "note" && (
            <button type="button" onClick={() => turn("h2")}>
              {current === "h2" ? "Paragraph" : "Heading"}
            </button>
          )}
          {current && current !== "note" && (
            <button type="button" onClick={() => turn("quote")}>
              {current === "quote" ? "Paragraph" : "Quote"}
            </button>
          )}
          {current === "p" && !hasNote && (
            <button type="button" onClick={sidenote}>
              Sidenote
            </button>
          )}
          <button type="button" onClick={() => wrap("*", "*")}>
            Emphasis
          </button>
          <button type="button" onClick={link}>
            Link
          </button>
        </div>
      )}

      <div className="adm-meta">
        {spec.fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input
              type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
              value={String(draft[field.key])}
              inputMode={field.kind === "number" ? "numeric" : undefined}
              onChange={(event) =>
                set({
                  [field.key]:
                    field.kind === "number" ? Number(event.target.value) : event.target.value,
                } as Partial<Draft>)
              }
            />
          </label>
        ))}
      </div>

      <div className="adm-actions">
        <p className={error ? "adm-status bad" : "adm-status"} role="status">
          {status}
        </p>

        <button
          className={spec.draftable ? "adm-btn" : "adm-btn primary"}
          type="button"
          onClick={() => void persist()}
          disabled={busy || !ready}
        >
          Save
        </button>

        {spec.draftable && (
          <button
            className={published ? "adm-btn" : "adm-btn primary"}
            type="button"
            onClick={() => void togglePublished(!published)}
            disabled={busy || !ready}
          >
            {published ? "Unpublish" : "Publish"}
          </button>
        )}

        {onSite && draft.id !== null && (
          <a className="adm-btn" href={`${spec.route}/${draft.slug}`} target="_blank" rel="noreferrer">
            View
          </a>
        )}

        <button
          className="adm-btn quiet"
          type="button"
          onClick={() => void remove()}
          disabled={busy || !ready}
        >
          Delete
        </button>
      </div>

      <Link className="more" href={`/admin/${spec.section}`}>
        All {spec.plural.toLowerCase()}
      </Link>
    </>
  );
}
