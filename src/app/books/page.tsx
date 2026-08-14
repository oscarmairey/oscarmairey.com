import type { Metadata } from "next";
import Entries from "@/components/site/entries";
import { published } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Books",
  description: "Books I've actually finished, with the reason each one stayed.",
  alternates: { canonical: "/books" },
};

/** The author is stored and editable in /admin; the list does not print it. */
export default async function BooksPage() {
  const books = await published("books");

  return (
    <>
      <h1 className="vh">Books</h1>
      <section className="section">
        <Entries section="books" items={books} />
      </section>
    </>
  );
}
