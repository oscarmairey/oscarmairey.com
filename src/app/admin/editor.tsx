"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Entry from "@/components/site/entry";
import { lastNote, parseBody, readingTime, serializeBlocks, type Block } from "@/lib/blocks";
import { formatDay } from "@/lib/format";
import { itemOf, sections, type Draft, type EditField, type Version } from "@/lib/labels";
import { ACCEPT, images, prepare } from "@/lib/media";
import { addVersion, deleteVersion, saveItem, setItemPublished, setLiveVersion } from "./actions";
import { Body, Region, blocksFromDom, caretInto, figureHtml, listFrom, listInto } from "./editable";

/** The editor is the page. There is no form and no preview: what is on screen
 *  is <Entry>, the component the public route mounts, with its title, its line
 *  under the title and its body handed in editable.
 *
 *  Whatever a label prints under the title — a company's period and role, a
 *  book's author, a note's date — is set in the stamp, where it prints.
 *
 *  Nothing is pressed to save it. Three seconds after the typing stops, what is
 *  on screen is what is in the database; the only deliberate presses left are
 *  the one that puts it on the site and the one that takes it off.
 *
 *  The slug and the reading time are not edited at all, and the slug is not
 *  even held here: both are derived on the server, from the title and the
 *  body, and only the date it settles on comes back.
 *
 *  An entry can be written more than once. The line above the bar names its
 *  versions, opens one, starts another from the one on screen, and says which of
 *  them a reader gets; that last is a press of its own, weighed the same as
 *  publishing, and nothing else moves it. Opening a version is a
 *  navigation, because the page is mounted from the version it is showing and a
 *  region is written exactly once. Whatever is unsaved goes first, and every
 *  save carries the version it was typed into, so nothing lands in the wrong
 *  one. */

type Props = {
  initial: Draft;
  live: boolean;
  slug: string;
  versions: Version[];
  liveVersionId: number;
};

const AUTOSAVE_MS = 3000;

/** Where a save landed: the entry, and the version of it that was written. */
type Landed = { id: number; versionId: number };

/** Where the menu opens, and what it is being asked about. */
type Menu = { x: number; y: number; block: HTMLElement | null; onText: boolean } | null;

/** What counts as a change. The reading time is left out because it is derived
 *  from the body, which is in here already. */
const snapshotOf = (draft: Draft) =>
  JSON.stringify([draft.title, draft.subtitle, draft.body, draft.byline, draft.period, draft.date]);

export default function Editor({ initial, live, slug, versions, liveVersionId }: Props) {
  const router = useRouter();
  const spec = sections[initial.section];

  const [draft, setDraft] = useState(initial);
  const [published, setPublished] = useState(live);
  const [menu, setMenu] = useState<Menu>(null);
  const [dating, setDating] = useState(false);

  /* Both move without the page being loaded again: the first save of a new
     entry makes its v1, and making a version live is answered rather than
     re-rendered — the editor stays where it is, with what is in it. */
  const [all, setAll] = useState(versions);
  const [liveId, setLiveId] = useState(liveVersionId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  /* Nothing here works until React has taken the page over, and an editor that
     quietly drops what is typed into it is worse than one that says so. */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  /* The address, which follows the title while the entry is a draft. Kept in a
     ref because changing it is not a render: the URL moves, the editor does
     not, and whatever is being typed stays where it is. */
  const address = useRef(slug);

  const host = useRef<HTMLDivElement>(null);
  const menuEl = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  /* Read once. After that the host is the browser's and the model follows it. */
  const opening = useMemo(() => parseBody(initial.body), [initial.body]);

  /* Nothing written here yet. Read from what was mounted, not from what is being
     typed, so it does not change under the caret it decides. */
  const blank = initial.title === "" && initial.body === "";

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const took = (blocks: Block[]) => set({ body: serializeBlocks(blocks) });
  const reread = () => host.current && took(blocksFromDom(host.current));

  /* ---- what gets sent ---------------------------------------------------- */

  const sending: Draft = {
    ...draft,
    readingTime: spec.label === "note" ? readingTime(draft.body) : "",
  };

  const snapshot = snapshotOf(sending);
  const savedRef = useRef(snapshot);
  const sendingRef = useRef(sending);
  sendingRef.current = sending;

  const dirty = snapshot !== savedRef.current;

  async function persist(): Promise<Landed | null> {
    const payload = sendingRef.current;

    setBusy(true);
    setError("");
    try {
      const result = await saveItem(payload);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      /* The date can come back changed — a first publish stamps one, and an
         unreadable one is dropped — so what counts as saved is what the server
         settled on, not what was sent. */
      savedRef.current = snapshotOf({ ...payload, id: result.id, date: result.date });
      setSavedAt(new Date());
      setDraft((d) => ({ ...d, id: result.id, versionId: result.versionId, date: result.date }));

      /* The first save of a new entry is also what makes its v1, and the line
         that names the versions has had nothing to name until now. */
      setAll((was) => (was.length > 0 ? was : [{ id: result.versionId, n: 1 }]));
      setLiveId((was) => was || result.versionId);

      /* A draft's slug follows its title, and a new entry has none until the
         first save gives it one. Either way the address in the bar is the one
         a reload should land on, version and all. */
      if (result.slug && result.slug !== address.current) {
        address.current = result.slug;
        window.history.replaceState(null, "", editorPath(result.slug));
      }
      return { id: result.id, versionId: result.versionId };
    } catch {
      setError("The save did not go through. Check the connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** The address of this editor, keeping whichever version it is open on. */
  const editorPath = (to: string) =>
    `/admin/${spec.section}/${to}${typeof window === "undefined" ? "" : window.location.search}`;

  /** Where a version-changing press starts: on the entry as it stands, with
   *  nothing typed left behind. */
  async function settle(): Promise<Landed | null> {
    if (draft.id === null || draft.versionId === null || dirty) return persistRef.current();
    return { id: draft.id, versionId: draft.versionId };
  }

  const persistRef = useRef(persist);
  persistRef.current = persist;

  /* Everything saves itself, three seconds after the typing stops — a draft
     nobody has seen and a page a reader is on, the same way. An entry that has
     never been saved and has no title is the one exception: there is no name to
     make an address from, so nothing is written until there is one. An entry
     that already exists has an address, so a version of it that starts on the
     body and gets its title last saves from the first word. */
  useEffect(() => {
    if (snapshot === savedRef.current) return;
    if (sendingRef.current.id === null && !sendingRef.current.title.trim()) return;

    const timer = setTimeout(() => void persistRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [snapshot]);

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

  /* ---- the menu ----------------------------------------------------------- */

  /** The block the selection is in: a direct child of the host, or the figure
   *  around a caption. */
  function blockAt(): HTMLElement | null {
    const node = window.getSelection()?.anchorNode ?? null;
    let el = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
    if (!el || !host.current?.contains(el)) return null;

    const figure = el.closest("figure");
    if (figure) return figure;
    while (el.parentElement && el.parentElement !== host.current) el = el.parentElement;
    return el;
  }

  function open(x: number, y: number) {
    const block = blockAt();
    if (!block) return;
    const selection = window.getSelection();
    setMenu({ x, y, block, onText: !!selection && !selection.isCollapsed });
  }

  /** Every formatting action is a DOM edit, made by the browser where it can
   *  be, so the selection and the undo stack survive it. The model is read back
   *  afterwards; nothing writes into the host from React. */
  function apply(run: () => void) {
    run();

    /* The selection asked its question and has been answered: leave the caret
       at the end of what was just changed rather than the text sitting there
       highlighted, waiting to be typed over by accident. */
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) selection.collapseToEnd();

    reread();
    setMenu(null);
  }

  function caretTo(el: HTMLElement | null) {
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  const mark = (command: string) => () => apply(() => document.execCommand(command));
  function list() {
    const block = menu?.block;
    if (!block) return setMenu(null);

    apply(() => {
      if (block.tagName === "UL" || block.tagName === "OL") {
        const paragraphs = listInto(block);
        caretInto(paragraphs[paragraphs.length - 1], true);
      } else {
        caretInto(listFrom(block).querySelector("li") as HTMLElement, true);
      }
    });
  }

  function link() {
    const href = window.prompt("Link to");
    if (!href) return setMenu(null);
    apply(() => document.execCommand("createLink", false, href.trim()));
  }

  function heading() {
    const was = menu?.block?.tagName;
    apply(() => document.execCommand("formatBlock", false, was === "H2" ? "p" : "h2"));
  }

  /** A quote is built rather than formatted: formatBlock would wrap the text
   *  and leave nowhere to name who said it. */
  function quote() {
    const block = menu?.block;
    if (!block) return setMenu(null);

    apply(() => {
      if (block.tagName === "BLOCKQUOTE") {
        const said = block.querySelector("p:not(.src)");
        const p = document.createElement("p");
        p.innerHTML = said?.innerHTML ?? block.innerHTML;
        block.replaceWith(p);
        caretTo(p);
        return;
      }

      const wrap = document.createElement("blockquote");
      const said = document.createElement("p");
      said.innerHTML = block.innerHTML || "<br>";
      const source = document.createElement("p");
      source.className = "src";
      source.innerHTML = "<br>";
      wrap.append(said, source);
      block.replaceWith(wrap);
      caretTo(said);
    });
  }

  function sidenote() {
    const block = menu?.block;
    if (!block || block.tagName !== "P" || block.querySelector(".sn")) return setMenu(null);

    const n = lastNote(draft.body) + 1;

    apply(() => {
      document.execCommand("insertHTML", false, `<sup class="ref" data-ref="${n}">${n}</sup>`);
      const note = document.createElement("span");
      note.className = "sn";
      note.innerHTML = `<span class="n" contenteditable="false">${n}</span>`;
      block.append(note);
      caretTo(note);
    });
  }

  function removeImage() {
    const block = menu?.block;
    if (block?.tagName === "FIGURE") apply(() => block.remove());
    else setMenu(null);
  }

  /* A selection is a question about the text under it, so the menu answers it
     without being asked twice. A right click still opens it where it happened,
     and a screen with no right button needs nothing else. */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const onSelect = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (!host.current?.contains(range.commonAncestorContainer)) return;

        const box = range.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) return;
        open(box.left, box.bottom + 6);
      }, 260);
    };

    document.addEventListener("selectionchange", onSelect);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelect);
    };
  }, []);

  useEffect(() => {
    if (!menu) return;

    const close = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuEl.current?.contains(target)) return;
      setMenu(null);
    };

    /* A menu opened over a selection lives as long as that selection does:
       delete it, type over it, or move the caret out of the editor and there is
       nothing left for the menu to answer. One opened on a caret by right click
       is not about a selection and is not closed by the absence of one — it
       would close itself the moment it opened. */
    const gone = () => {
      if (!menu.onText) return;
      const selection = window.getSelection();
      const inside =
        selection && selection.rangeCount > 0 && host.current?.contains(selection.anchorNode);
      if (!inside || selection.isCollapsed || selection.toString().trim() === "") setMenu(null);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("selectionchange", gone);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("selectionchange", gone);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  /* ---- images -------------------------------------------------------------- */

  async function upload(file: File) {
    setMenu(null);
    setBusy(true);
    setError("");
    try {
      /* Shrunk here, in the browser that already has it open, so what lands on
         disk is what a reader should be asked to download. */
      const { file: sending, size } = await prepare(file);

      const form = new FormData();
      form.set("file", sending);
      if (size) {
        form.set("width", String(size.width));
        form.set("height", String(size.height));
      }

      const answer = await fetch("/admin/media", { method: "POST", body: form });
      if (!answer.ok) {
        setError("That image did not upload. PNG, JPEG, WebP, GIF or AVIF, under 8 MB.");
        return;
      }

      const { name } = (await answer.json()) as { name: string };
      const holder = document.createElement("template");
      holder.innerHTML = figureHtml({ kind: "image", src: name, text: "" });
      const figure = holder.content.firstElementChild as HTMLElement | null;
      if (!figure) return;

      const at = blockAt() ?? host.current?.lastElementChild ?? null;
      if (at) at.after(figure);
      else host.current?.append(figure);

      caretTo(figure.querySelector("figcaption"));
      reread();
    } catch {
      setError("That image did not upload. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  /* ---- versions ------------------------------------------------------------ */

  /** Opening another version is a navigation: the page is mounted from the
   *  version it shows, so there is a new one to mount. */
  async function openVersion(n: number) {
    if (busy) return;
    if (dirty && (await persistRef.current()) === null) return;
    router.push(`/admin/${spec.section}/${address.current}?v=${n}`);
  }

  /** Another go, started from the one on screen. A rewrite begins with what is
   *  already there and takes out what it does not want, and the version it
   *  began from stays exactly where it was, one press away. */
  async function another() {
    const at = await settle();
    if (!at) return;

    setBusy(true);
    const result = await addVersion(spec.section, at.id, at.versionId);
    setBusy(false);

    if (!result.ok) return setError(result.error);
    router.push(`/admin/${spec.section}/${address.current}?v=${result.n}`);
  }

  /** One version thrown away. Offered only where it is allowed, which is any
   *  version but the one a reader is being shown: there is always a page behind
   *  the address, and the last version of an entry is by definition the live
   *  one. Deleting the entry itself is the other press, and says so. */
  async function removeVersion() {
    const at = await settle();
    if (!at) return;

    const mine = all.find((one) => one.id === at.versionId);
    const to = all.find((one) => one.id === liveId);
    if (!mine || !to) return;

    if (
      !window.confirm(
        `Delete v${mine.n}? The ${spec.one} and its other versions stay. This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusy(true);
    const result = await deleteVersion(spec.section, at.id, at.versionId);
    setBusy(false);

    if (!result.ok) return setError(result.error);

    /* Nothing is being typed into any more, so the way out is the live one. */
    savedRef.current = snapshotOf(sendingRef.current);
    router.push(`/admin/${spec.section}/${address.current}?v=${to.n}`);
  }

  /** The press that changes what is on the site. */
  async function makeLive() {
    const at = await settle();
    if (!at) return;

    setBusy(true);
    const result = await setLiveVersion(spec.section, at.id, at.versionId);
    setBusy(false);

    if (!result.ok) return setError(result.error);
    setLiveId(at.versionId);
    setSavedAt(new Date());

    /* A draft's address follows the live version's title, so this can move it. */
    if (result.slug && result.slug !== address.current) {
      address.current = result.slug;
      window.history.replaceState(null, "", editorPath(result.slug));
    }
  }

  /* ---- the rest ------------------------------------------------------------ */

  async function togglePublished(next: boolean) {
    const at = await settle();
    if (!at) return;

    setBusy(true);
    const result = await setItemPublished(spec.section, at.id, next);
    setBusy(false);

    if (!result.ok) return setError(result.error);
    setPublished(next);

    /* Publishing an undated entry dates it. Without taking that back, the next
       save would send the empty date the editor still holds and un-date what is
       already on the site. */
    setDraft((d) => ({ ...d, date: result.date }));
    savedRef.current = snapshotOf({ ...sendingRef.current, date: result.date });
    setSavedAt(new Date());
  }

  /* The line says what is happening to what is being typed, and nothing else.
     Whether a reader can see this is already on the press beside it: a button
     offering to publish is a thing that is not published. Saying it twice was
     saying it once too often. */
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
              : "";

  /* Whatever a label prints under the title is set under the title: a company's
     period and role are typed there, and a note's date is picked there. */
  const editField: EditField = (field) => {
    if (field.kind === "date") {
      return dating ? (
        <input
          className="adm-when"
          type="date"
          autoFocus
          value={draft.date}
          onChange={(event) => set({ date: event.target.value })}
          onBlur={() => setDating(false)}
          onKeyDown={(event) => event.key === "Enter" && setDating(false)}
        />
      ) : (
        <button className="adm-when" type="button" onClick={() => setDating(true)}>
          {draft.date ? formatDay(draft.date) : "Undated"}
        </button>
      );
    }

    return (
      <Region
        key={field.key}
        as="span"
        region={field.key}
        source={draft[field.key]}
        placeholder={field.label}
        onChange={(value) => set({ [field.key]: value } as Partial<Draft>)}
      />
    );
  };

  const kind = menu?.block?.tagName;

  /* The version on screen, as the line names it. */
  const mine = all.find((one) => one.id === draft.versionId);

  return (
    <>
      <div
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
                region="title"
                source={draft.title}
                placeholder={spec.name}
                /* A page with nothing on it is a page waiting to be written
                   into, whether it is a new entry or a new version of an old
                   one, so the caret starts at the top of it. */
                focus={blank}
                onChange={(title) => set({ title })}
              />
            ),
            sub: (
              <Region
                as="span"
                region="sub"
                source={draft.subtitle}
                placeholder={spec.sub}
                onChange={(subtitle) => set({ subtitle })}
              />
            ),
            body: (
              <Body
                hostRef={host}
                blocks={opening}
                onChange={took}
                onFiles={(files) => void upload(files[0])}
                onLink={link}
              />
            ),
            edit: editField,
          }}
        />
      </div>

      {menu && (
        <div
          ref={menuEl}
          className="adm-menu"
          style={{ left: menu.x, top: menu.y }}
          /* Keeps the selection the menu is about to act on. */
          onMouseDown={(event) => event.preventDefault()}
        >
          {kind === "FIGURE" ? (
            <button type="button" onClick={removeImage}>
              Remove image
            </button>
          ) : (
            <>
              <button type="button" onClick={heading}>
                {kind === "H2" ? "Paragraph" : "Heading"}
              </button>
              <button type="button" onClick={quote}>
                {kind === "BLOCKQUOTE" ? "Paragraph" : "Quote"}
              </button>
              <button type="button" onClick={list}>
                {kind === "UL" ? "Paragraph" : "List"}
              </button>
              {kind === "P" && !menu.block?.querySelector(".sn") && (
                <button type="button" onClick={sidenote}>
                  Sidenote
                </button>
              )}
              <button type="button" onClick={() => picker.current?.click()}>
                Image
              </button>
              <button type="button" onClick={mark("bold")}>
                Bold
              </button>
              <button type="button" onClick={mark("italic")}>
                Italic
              </button>
              <button type="button" onClick={mark("underline")}>
                Underline
              </button>
              <button type="button" onClick={link}>
                Link
              </button>
            </>
          )}
        </div>
      )}

      {/* The fallback way in, for a screen with no clipboard and no drag. */}
      <input
        ref={picker}
        className="adm-picker"
        type="file"
        accept={ACCEPT}
        aria-label="Add an image"
        onChange={(event) => {
          const chosen = images(event.target.files);
          event.target.value = "";
          if (chosen.length > 0) void upload(chosen[0]);
        }}
      />

      <div className="adm-actions">
        {/* Which version is being written, which one a reader gets, and the two
            ways to start another. Nothing to name until the first save has made
            a v1, so nothing is printed until then. */}
        {all.length > 0 && (
          <p className="adm-versions">
            {all.map((one) => (
              <button
                key={one.id}
                className={one.id === draft.versionId ? "adm-v on" : "adm-v"}
                type="button"
                data-version={one.n}
                aria-current={one.id === draft.versionId ? "true" : undefined}
                onClick={() => void openVersion(one.n)}
                disabled={busy || !ready}
              >
                v{one.n}
                {one.id === liveId && <span className="adm-vlive"> live</span>}
              </button>
            ))}

            {/* One more, at the end of the row it belongs to, because that is
                what it makes: a copy of the one being read, to write over. */}
            <button
              className="adm-v adm-vplus"
              type="button"
              aria-label={`Another version, starting from v${mine?.n ?? 1}`}
              onClick={() => void another()}
              disabled={busy || !ready}
            >
              +
            </button>

            {/* Only where it is allowed: any version but the one a reader is
                being shown, which is also the only version an entry with one
                version has. Nothing here deletes an entry. */}
            {draft.versionId !== null && draft.versionId !== liveId && (
              <button
                className="adm-v adm-vgone"
                type="button"
                onClick={() => void removeVersion()}
                disabled={busy || !ready}
              >
                Delete this version
              </button>
            )}
          </p>
        )}

        <p className={error ? "adm-status bad" : "adm-status"} role="status">
          {status}
        </p>

        <button
          className={published ? "adm-btn" : "adm-btn primary"}
          type="button"
          onClick={() => void togglePublished(!published)}
          disabled={busy || !ready}
        >
          {published ? "Unpublish" : "Publish"}
        </button>

        {/* Only where it means something: the version on screen is not the one
            a reader gets, and one press is the whole of changing that. */}
        {draft.versionId !== null && draft.versionId !== liveId && (
          <button
            className="adm-btn"
            type="button"
            onClick={() => void makeLive()}
            disabled={busy || !ready}
          >
            Make live
          </button>
        )}

        {/* And nothing that deletes the entry. Unpublishing is how a thing comes
            off the site, and it keeps it. */}
      </div>

      <Link className="more" href={`/admin/${spec.section}`}>
        All {spec.plural.toLowerCase()}
      </Link>
    </>
  );
}
