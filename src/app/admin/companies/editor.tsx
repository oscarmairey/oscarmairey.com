"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Prose from "@/components/site/prose";
import { parseBody, slugify } from "@/lib/blocks";
import { inline } from "@/lib/inline";
import { deleteCompany, saveCompany, type CompanyDraft } from "../actions";

/** The preview mounts the same <Prose> /building/[slug] mounts, in the same
 *  classes and the same column, so what shows here is what ships.
 *
 *  A company has no draft state — it is on the site the moment it exists — so
 *  it saves on a deliberate press rather than as you type, for the same reason
 *  a published writing does. */

type Props = { initial: CompanyDraft };

const snapshotOf = (d: CompanyDraft) =>
  JSON.stringify([d.name, d.role, d.period, d.summary, d.slug, d.body, d.url, d.sortOrder]);

export default function CompanyEditor({ initial }: Props) {
  const router = useRouter();

  const [id, setId] = useState(initial.id);
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState(initial.role);
  const [period, setPeriod] = useState(initial.period);
  const [summary, setSummary] = useState(initial.summary);
  const [slug, setSlug] = useState(initial.slug);
  const [body, setBody] = useState(initial.body);
  const [url, setUrl] = useState(initial.url);
  const [sortOrder, setSortOrder] = useState(initial.sortOrder);

  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  /* The slug trails the name until it is edited by hand, and then it stops. */
  const [slugPinned, setSlugPinned] = useState(initial.slug !== "");

  const current: CompanyDraft = {
    id,
    name,
    role,
    period,
    summary,
    slug,
    body,
    url,
    sortOrder,
  };
  const snapshot = snapshotOf(current);

  const savedRef = useRef(snapshot);
  const currentRef = useRef(current);
  currentRef.current = current;

  const dirty = snapshot !== savedRef.current;

  async function persist() {
    const sending = currentRef.current;
    const sent = snapshotOf(sending);

    setBusy(true);
    setError("");
    try {
      const result = await saveCompany(sending);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      savedRef.current = sent;
      setSavedAt(new Date());
      if (sending.id === null) {
        setId(result.id);
        currentRef.current = { ...currentRef.current, id: result.id };
        window.history.replaceState(null, "", `/admin/companies/${result.id}`);
      }
      router.refresh();
    } catch {
      setError("The save did not go through. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const persistRef = useRef(persist);
  persistRef.current = persist;

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

  async function remove() {
    if (id === null) {
      router.push("/admin/companies");
      return;
    }
    if (!window.confirm(`Remove “${name || "Untitled"}” from the record? This cannot be undone.`)) {
      return;
    }
    savedRef.current = snapshot; // stop the unload warning firing on the way out
    setBusy(true);
    await deleteCompany(id);
  }

  const blocks = parseBody(body);
  const stamp = [period, role].filter(Boolean).join(" · ");

  const status = error
    ? error
    : busy
      ? "Saving…"
      : dirty
        ? "Unsaved changes"
        : savedAt
          ? `Saved at ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
          : id === null
            ? "Not saved yet"
            : "On the site";

  return (
    <>
      <h1 className="adm-title">{id === null ? "New company" : "Edit"}</h1>
      <p className="adm-hint">
        This is live the moment you save it. The summary is the line the home page and /building
        show; the body is the page itself.
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
            <span>Name</span>
            <input
              className="adm-input big"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugPinned) setSlug(slugify(e.target.value));
              }}
              placeholder="Untitled"
              autoComplete="off"
            />
          </label>

          <div className="adm-pair">
            <label className="adm-field">
              <span>Role</span>
              <input
                className="adm-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="What you did there"
                autoComplete="off"
              />
            </label>
            <label className="adm-field">
              <span>Period</span>
              <input
                className="adm-input"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2024–2025, or Now"
                autoComplete="off"
              />
            </label>
          </div>

          <label className="adm-field">
            <span>Summary</span>
            <input
              className="adm-input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="The one line the lists show."
              autoComplete="off"
            />
          </label>

          <label className="adm-field">
            <span>Slug — /building/{slug || "…"}</span>
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
              <span>Link</span>
              <input
                className="adm-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                autoComplete="off"
                spellCheck={false}
                inputMode="url"
              />
            </label>
            <label className="adm-field">
              <span>Order</span>
              <input
                className="adm-input"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                inputMode="numeric"
              />
            </label>
          </div>

          <label className="adm-field">
            <span>Body</span>
            <textarea
              className="adm-area"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="One blank line between paragraphs. Leave it empty and the page shows the summary."
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
          <h1 className="title">{name || "Untitled"}</h1>
          {summary && <p className="sub">{summary}</p>}
          {stamp && <p className="stamp">{stamp}</p>}
          {blocks.length > 0 ? (
            <Prose blocks={blocks} />
          ) : (
            <div className="prose">
              <p>{inline(summary)}</p>
            </div>
          )}
        </article>
      )}

      <div className="adm-actions">
        <p className={error ? "adm-status bad" : "adm-status"} role="status">
          {status}
        </p>

        <button className="adm-btn primary" type="button" onClick={() => void persist()} disabled={busy}>
          Save
        </button>

        {id !== null && (
          <a className="adm-btn" href={`/building/${slug}`} target="_blank" rel="noreferrer">
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
