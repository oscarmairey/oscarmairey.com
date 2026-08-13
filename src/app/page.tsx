import Link from "next/link";
import { site } from "@/content/site";
import { publicBooks, publicCompanies, publishedWritings } from "@/lib/content";
import { formatMonth } from "@/lib/format";

/** Rendered per request, on top of the cache in src/lib/content.ts: a publish
 *  from /admin is visible on the next load, and a database that is down costs
 *  freshness rather than the page. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const [writings, books, companies] = await Promise.all([
    publishedWritings(),
    publicBooks(),
    publicCompanies(),
  ]);

  return (
    <>
      <div className="lede">
        <p>{site.bio}</p>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Writings</h2>
          <Link className="more" href="/writings">
            All writings
          </Link>
        </div>
        <ul className="rows tight">
          {writings.slice(0, 5).map((w) => (
            <li key={w.slug}>
              <p className="line">
                <Link className="t" href={`/writings/${w.slug}`}>
                  {w.title}
                </Link>
                <time className="when" dateTime={w.date}>
                  {formatMonth(w.date)}
                </time>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Books</h2>
          <Link className="more" href="/books">
            All books
          </Link>
        </div>
        <ul className="rows">
          {books.slice(0, 5).map((b) => (
            <li key={b.id}>
              {/* Titles only on the index. The authors are on /books. */}
              <p className="line">
                <span className="t">{b.title}</span>
                {b.year && <span className="when">{b.year}</span>}
              </p>
              <p className="note">{b.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Building</h2>
          <Link className="more" href="/building">
            Full record
          </Link>
        </div>
        <ul className="rows">
          {companies.slice(0, 5).map((c) => (
            <li key={c.slug}>
              <p className="line">
                <Link className="t" href={`/building/${c.slug}`}>
                  {c.name}
                </Link>
                {c.period && <span className="when">{c.period}</span>}
              </p>
              <p className="note">{c.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
