import type { Metadata } from "next";
import Link from "next/link";
import { published, formatMonth } from "@/content/writings";

export const metadata: Metadata = {
  title: "Writings",
  description: "Notes on markets and the software underneath them.",
  alternates: { canonical: "/writings" },
};

export default function WritingsPage() {
  return (
    <>
      <h1 className="title">Writings</h1>
      <p className="sub">Notes on markets and the software underneath them.</p>

      <section className="section">
        <ul className="rows">
          {published.map((w) => (
            <li key={w.slug}>
              <p className="line">
                <Link className="t" href={`/writings/${w.slug}`}>
                  {w.title}
                </Link>
                <time className="when" dateTime={w.date}>
                  {formatMonth(w.date)}
                </time>
              </p>
              <p className="note">{w.subtitle}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
