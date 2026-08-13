import type { Metadata } from "next";
import { books } from "@/content/books";

export const metadata: Metadata = {
  title: "Books",
  description: "Books I've actually finished, with the reason each one stayed.",
  alternates: { canonical: "/books" },
};

export default function BooksPage() {
  return (
    <>
      <h1 className="title">Books</h1>

      <section className="section">
        <ul className="rows">
          {books.map((b) => (
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
    </>
  );
}
