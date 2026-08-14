"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Entry from "@/components/site/entry";
import { slugify } from "@/lib/blocks";
import { itemOf, sections, type Draft, type Field } from "@/lib/labels";
import { deleteItem, saveItem, setItemPublished } from "./actions";

/** One editor for the three labels. The fields it shows, the words it uses and
 *  whether it has a draft state come from src/lib/labels.tsx; everything else —
 *  the autosave, the preview, the keyboard save, the unload warning — is
 *  written once here.
 *
 *  The preview is not a second renderer: it mounts the same <Entry> the public
 *  page mounts, inside the same classes, in the same 44rem column. What is on
 *  the Preview tab is what ships, sidenotes included. */

type Props = { initial: Draft; live: boolean };

const AUTOSAVE_MS = 1500;

/** The id is not content: it arrives on the first save and must not read as an
 *  edit when it does. */
const snapshotOf = ({ id: _id, ...rest }: Draft) => JSON.stringify(rest);

export default function Editor({ initial, live }: Props) {
  const router = useRouter();
  const spec = sections[initial.section];

  const [draft, setDraft] = useState(initial);
  const [published, setPublished] = useState(live);

  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  /* Nothing here works until React has taken the page over, and a Save button
     that quietly does nothing is worse than no button. Until this flips, the
     controls are visibly disabled and say so. */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  /* The slug trails the title until it is edited by hand, and then it stops. */
  const [slugPinned, setSlugPinned] = useState(initial.slug !== "");

  const set = (key: Exclude<keyof Draft, "id" | "section">, value: string | number) =>
    setDraft((d) => ({ ...d, [key]: value }) as Draft);

  const snapshot = snapshotOf(draft);

  const savedRef = useRef(snapshot);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const dirty = snapshot !== savedRef.current;

  async function persist(): Promise<number | null> {
    const sending = draftRef.current;
    const sent = snapshotOf(sending);

    setBusy(true);
    setError("");
    try {
      const result = await saveItem(sending);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      savedRef.current = sent;
      setSavedAt(new Date());
      if (sending.id === null) {
        setDraft((d) => ({ ...d, id: result.id }));
        draftRef.current = { ...draftRef.current, id: result.id };
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
    if (!draft.title.trim() && !draft.slug.trim()) return;

    const timer = setTimeout(() => void persistRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [snapshot, published, spec.draftable, draft.title, draft.slug]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void persistRef.current();
      }
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

  async function togglePublished(next: boolean) {
    const savedId = await persist();
    if (savedId === null) return;

    setBusy(true);
    const result = await setItemPublished(spec.section, savedId, next);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPublished(next);
    setSavedAt(new Date());
    router.refresh();
  }

  async function remove() {
    if (draft.id === null) {
      router.push(`/admin/${spec.section}`);
      return;
    }
    if (!window.confirm(`Delete “${draft.title || "Untitled"}”? This cannot be undone.`)) return;
    savedRef.current = snapshot; // stop the unload warning firing on the way out
    setBusy(true);
    await deleteItem(spec.section, draft.id);
  }

  function control(field: Field) {
    const value = draft[field.key];

    if (field.kind === "area") {
      return (
        <textarea
          className="adm-area"
          value={String(value)}
          onChange={(e) => set(field.key, e.target.value)}
          placeholder={field.placeholder}
          spellCheck
        />
      );
    }

    if (field.kind === "number") {
      return (
        <input
          className="adm-input"
          type="number"
          value={Number(value)}
          onChange={(e) => set(field.key, Number(e.target.value))}
          inputMode="numeric"
        />
      );
    }

    return (
      <input
        className="adm-input"
        type={field.kind === "date" ? "date" : "text"}
        value={String(value)}
        onChange={(e) => set(field.key, e.target.value)}
        placeholder={field.placeholder}
        autoComplete="off"
        spellCheck={field.key === "subtitle"}
      />
    );
  }

  const hasBody = spec.rows.some((row) => row.some((field) => field.kind === "area"));
  const onSite = published || !spec.draftable;

  const status = !ready
    ? "Loading the editor…"
    : error
      ? error
      : busy
        ? "Saving…"
        : dirty
          ? onSite
            ? "Unsaved changes"
            : "Unsaved"
          : savedAt
            ? `Saved at ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
            : draft.id === null
              ? "Not saved yet"
              : onSite
                ? "On the site"
                : "Draft";

  return (
    <>
      <h1 className="adm-title">
        {draft.id === null ? `New ${spec.one}` : published || !spec.draftable ? "Edit" : "Draft"}
      </h1>
      <p className="adm-hint">
        {spec.draftable && published
          ? "This is live. Changes go out when you press Save."
          : spec.hint}
      </p>

      <div className="adm-tabs" role="tablist" aria-label="Editor view">
        <button
          className="adm-tab"
          role="tab"
          type="button"
          aria-selected={tab === "write"}
          onClick={() => setTab("write")}
        >
          Write
        </button>
        <button
          className="adm-tab"
          role="tab"
          type="button"
          aria-selected={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>

      {tab === "write" ? (
        <div role="tabpanel">
          <label className="adm-field">
            <span>{spec.name}</span>
            <input
              className="adm-input big"
              value={draft.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!slugPinned) set("slug", slugify(e.target.value));
              }}
              placeholder="Untitled"
              autoComplete="off"
            />
          </label>

          <label className="adm-field">
            <span>
              Slug — {spec.route}/{draft.slug || "…"}
            </span>
            <input
              className="adm-input"
              value={draft.slug}
              onChange={(e) => {
                setSlugPinned(true);
                set("slug", e.target.value);
              }}
              onBlur={(e) => set("slug", slugify(e.target.value))}
              placeholder="a-few-words-with-hyphens"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {spec.rows.map((row, i) => {
            const fields = row.map((field) => (
              <label className="adm-field" key={field.key}>
                <span>{field.label}</span>
                {control(field)}
              </label>
            ));
            return row.length > 1 ? (
              <div className="adm-pair" key={i}>
                {fields}
              </div>
            ) : (
              fields
            );
          })}

          {hasBody && (
            <p className="adm-syntax">
              <code>## heading</code>
              <span className="sep">·</span>
              <code>&gt; quote</code> then <code>&gt; — source</code>
              <span className="sep">·</span>
              <code>[^1]: sidenote</code>
              <span className="sep">·</span>
              <code>[^1]</code> where it belongs in the text
              <span className="sep">·</span>
              <code>[label](url)</code>
              <span className="sep">·</span>
              <code>*emphasis*</code>
            </p>
          )}
        </div>
      ) : (
        <div className="adm-preview" role="tabpanel">
          <Entry
            section={spec.section}
            item={itemOf({ ...draft, title: draft.title || "Untitled" })}
          />
        </div>
      )}

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

        {spec.draftable &&
          (published ? (
            <button
              className="adm-btn"
              type="button"
              onClick={() => void togglePublished(false)}
              disabled={busy || !ready}
            >
              Unpublish
            </button>
          ) : (
            <button
              className="adm-btn primary"
              type="button"
              onClick={() => void togglePublished(true)}
              disabled={busy || !ready}
            >
              Publish
            </button>
          ))}

        {onSite && draft.id !== null && (
          <a
            className="adm-btn"
            href={`${spec.route}/${draft.slug}`}
            target="_blank"
            rel="noreferrer"
          >
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
    </>
  );
}
