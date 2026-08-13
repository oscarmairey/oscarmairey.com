"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Prose from "@/components/site/prose";
import { parseBody, slugify } from "@/lib/blocks";
import { formatDay } from "@/lib/format";
import { deleteWriting, saveWriting, setWritingPublished, type Draft } from "../actions";

/** The preview is not a second renderer: it mounts the same <Prose> the public
 *  page mounts, inside the same classes, in the same 44rem column. What is on
 *  the Preview tab is what ships, sidenotes included. */

type Props = { initial: Draft & { published: boolean } };

const AUTOSAVE_MS = 1500;

const snapshotOf = (d: Omit<Draft, "id">) =>
  JSON.stringify([d.title, d.subtitle, d.slug, d.body, d.readingTime, d.date]);

export default function Editor({ initial }: Props) {
  const router = useRouter();

  const [id, setId] = useState(initial.id);
  const [published, setPublished] = useState(initial.published);
  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [slug, setSlug] = useState(initial.slug);
  const [body, setBody] = useState(initial.body);
  const [readingTime, setReadingTime] = useState(initial.readingTime);
  const [date, setDate] = useState(initial.date);

  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  /* The slug trails the title until it is edited by hand, and then it stops. */
  const [slugPinned, setSlugPinned] = useState(initial.slug !== "");

  const current: Draft = { id, title, subtitle, slug, body, readingTime, date };
  const snapshot = snapshotOf(current);

  const savedRef = useRef(snapshot);
  const currentRef = useRef(current);
  currentRef.current = current;

  const dirty = snapshot !== savedRef.current;

  async function persist(): Promise<number | null> {
    const sending = currentRef.current;
    const sent = snapshotOf(sending);

    setBusy(true);
    setError("");
    try {
      const result = await saveWriting(sending);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      savedRef.current = sent;
      setSavedAt(new Date());
      if (sending.id === null) {
        setId(result.id);
        currentRef.current = { ...currentRef.current, id: result.id };
        window.history.replaceState(null, "", `/admin/writings/${result.id}`);
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

  /* Drafts save themselves. A published writing does not: an edit to something
     already on the site should take a deliberate press. */
  useEffect(() => {
    if (published) return;
    if (snapshot === savedRef.current) return;
    if (!title.trim() && !slug.trim()) return;

    const timer = setTimeout(() => void persistRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [snapshot, published, title, slug]);

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
    const result = await setWritingPublished(savedId, next);
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
    if (id === null) {
      router.push("/admin");
      return;
    }
    if (!window.confirm(`Delete “${title || "Untitled"}”? This cannot be undone.`)) return;
    savedRef.current = snapshot; // stop the unload warning firing on the way out
    setBusy(true);
    await deleteWriting(id);
  }

  const status = error
    ? error
    : busy
      ? "Saving…"
      : dirty
        ? published
          ? "Unsaved changes"
          : "Unsaved"
        : savedAt
          ? `Saved at ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
          : published
            ? "Published"
            : "Draft";

  return (
    <>
      <h1 className="adm-title">{published ? "Edit" : "Draft"}</h1>
      <p className="adm-hint">
        {published
          ? "This is live. Changes go out when you press Save."
          : "Only you can see this. It saves itself as you type."}
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
            <span>Title</span>
            <input
              className="adm-input big"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugPinned) setSlug(slugify(e.target.value));
              }}
              placeholder="Untitled"
              autoComplete="off"
            />
          </label>

          <label className="adm-field">
            <span>Subtitle</span>
            <input
              className="adm-input"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="The one sentence that gives the angle."
              autoComplete="off"
            />
          </label>

          <label className="adm-field">
            <span>Slug — /writings/{slug || "…"}</span>
            <input
              className="adm-input"
              value={slug}
              onChange={(e) => {
                setSlugPinned(true);
                setSlug(e.target.value);
              }}
              onBlur={(e) => setSlug(slugify(e.target.value))}
              placeholder="a-few-words-with-hyphens"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="adm-pair">
            <label className="adm-field">
              <span>Date</span>
              <input
                className="adm-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="adm-field">
              <span>Reading time</span>
              <input
                className="adm-input"
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                placeholder="9 min"
                autoComplete="off"
              />
            </label>
          </div>

          <label className="adm-field">
            <span>Body</span>
            <textarea
              className="adm-area"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="One blank line between paragraphs."
              spellCheck
            />
          </label>

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
        </div>
      ) : (
        <article className="adm-preview" role="tabpanel">
          <h1 className="title">{title || "Untitled"}</h1>
          {subtitle && <p className="sub">{subtitle}</p>}
          <p className="stamp">
            {date ? <time dateTime={date}>{formatDay(date)}</time> : "Undated"}
            {readingTime && ` · ${readingTime}`}
          </p>
          <Prose blocks={parseBody(body)} />
        </article>
      )}

      <div className="adm-actions">
        <p className={error ? "adm-status bad" : "adm-status"} role="status">
          {status}
        </p>

        <button className="adm-btn" type="button" onClick={() => void persist()} disabled={busy}>
          Save
        </button>

        {published ? (
          <button
            className="adm-btn"
            type="button"
            onClick={() => void togglePublished(false)}
            disabled={busy}
          >
            Unpublish
          </button>
        ) : (
          <button
            className="adm-btn primary"
            type="button"
            onClick={() => void togglePublished(true)}
            disabled={busy}
          >
            Publish
          </button>
        )}

        {published && id !== null && (
          <a className="adm-btn" href={`/writings/${slug}`} target="_blank" rel="noreferrer">
            View
          </a>
        )}

        <button className="adm-btn quiet" type="button" onClick={() => void remove()} disabled={busy}>
          Delete
        </button>
      </div>
    </>
  );
}
