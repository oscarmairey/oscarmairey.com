import Link from "next/link";
import { site, hooks } from "@/content/site";
import { published, formatMonth } from "@/content/writings";
import { books } from "@/content/books";
import { companies, currently } from "@/content/building";

export default function Home() {
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
        <p className="hook">{hooks.writings}</p>
        <ul className="rows tight">
          {published.slice(0, 5).map((w) => (
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
        <p className="hook">{hooks.books}</p>
        <ul className="rows">
          {books.slice(0, 5).map((b) => (
            <li key={b.title}>
              <p className="line">
                <span>
                  <span className="t">{b.title}</span>
                  <span className="by">{b.author}</span>
                </span>
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
        <p className="hook">{hooks.building}</p>
        <ul className="rows">
          <li>
            <p className="line">
              <span className="t">{currently.name}</span>
              <span className="when">Now</span>
            </p>
            <p className="note">{currently.summary}</p>
          </li>
          {companies.map((c) => (
            <li key={c.name}>
              <p className="line">
                <span className="t">{c.name}</span>
                <span className="when">{c.years}</span>
              </p>
              <p className="note">{c.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
