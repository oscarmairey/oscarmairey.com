import type { Metadata } from "next";
import { publicBooks } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Books",
  description: "Books I've actually finished, with the reason each one stayed.",
  alternates: { canonical: "/books" },
};

export default async function BooksPage() {
  const books = await publicBooks();

  return (
    <>
      <h1 className="title">Books</h1>

      <section className="section">
        <ul className="rows">
          {books.map((b) => (
            <li key={b.id}>
              <p className="line">
                <span>
                  <span className="t">{b.title}</span>
                  {b.author && <span className="by">{b.author}</span>}
                </span>
                {b.year && <span className="when">{b.year}</span>}
              </p>
              <p className="note">{b.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
