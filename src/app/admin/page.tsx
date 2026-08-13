import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listBooks, listWritings, type WritingRow } from "@/lib/editor";
import { formatMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

function Writings({ rows }: { rows: WritingRow[] }) {
  return (
    <ul className="adm-list">
      {rows.map((w) => (
        <li key={w.id}>
          <p className="adm-row">
            <Link className="adm-name" href={`/admin/writings/${w.id}`}>
              {w.title || "Untitled"}
            </Link>
            <span className={w.published ? "adm-state live" : "adm-state"}>
              {w.published ? (w.date ? formatMonth(w.date) : "Published") : "Draft"}
            </span>
          </p>
          {w.subtitle && <p className="adm-sub">{w.subtitle}</p>}
        </li>
      ))}
    </ul>
  );
}

export default async function Dashboard() {
  await requireSession();

  const [writings, books] = await Promise.all([listWritings(), listBooks()]);
  const drafts = writings.filter((w) => !w.published);
  const live = writings.filter((w) => w.published);

  return (
    <>
      <h1 className="adm-title">Editor</h1>
      <p className="adm-hint">
        {live.length} published, {drafts.length} in draft, {books.length} books.
      </p>

      <section className="adm-section">
        <h2>Drafts</h2>
        <p className="adm-hint">Saved as you type, invisible to everyone else.</p>
        {drafts.length > 0 ? <Writings rows={drafts} /> : <p className="adm-empty">Nothing in draft.</p>}
        <div className="adm-buttons" style={{ marginTop: "1.6rem" }}>
          <Link className="adm-btn primary" href="/admin/writings/new">
            New writing
          </Link>
        </div>
      </section>

      <section className="adm-section">
        <h2>Published</h2>
        {live.length > 0 ? <Writings rows={live} /> : <p className="adm-empty">Nothing published yet.</p>}
      </section>

      <section className="adm-section">
        <h2>Books</h2>
        <ul className="adm-list">
          {books.map((b) => (
            <li key={b.id}>
              <p className="adm-row">
                <span className="adm-name">{b.title}</span>
                <span className="adm-state">{b.year || b.author}</span>
              </p>
            </li>
          ))}
        </ul>
        {books.length === 0 && <p className="adm-empty">No books yet.</p>}
        <div className="adm-buttons" style={{ marginTop: "1.6rem" }}>
          <Link className="adm-btn" href="/admin/books">
            Edit books
          </Link>
        </div>
      </section>

      <p className="adm-foot">
        Writings and books live in Postgres. Everything else on the site — the bio, the record of
        companies, the talks — is still in <code>src/content</code>, and changing it means a deploy.
      </p>
    </>
  );
}
