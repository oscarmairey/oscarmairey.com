import type { Metadata } from "next";
import Link from "next/link";
import { publishedWritings } from "@/lib/content";
import { formatMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Writings",
  description: "Notes on markets and the software underneath them.",
  alternates: { canonical: "/writings" },
};

export default async function WritingsPage() {
  const writings = await publishedWritings();

  return (
    <>
      <h1 className="title">Writings</h1>

      <section className="section">
        <ul className="rows">
          {writings.map((w) => (
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
