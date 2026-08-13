import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { listBooks } from "@/lib/editor";
import { addBook, deleteBook, saveBook } from "../actions";
import ConfirmButton from "../confirm-button";

export const metadata: Metadata = { title: "Books" };
export const dynamic = "force-dynamic";

/** Plain forms and server actions: no client state to lose, and each book saves
 *  on its own. Order is a number because there are a dozen books, not a
 *  thousand — drag-and-drop would be more machinery than the problem. */
export default async function BooksAdmin() {
  await requireSession();
  const books = await listBooks();

  return (
    <>
      <h1 className="adm-title">Books</h1>
      <p className="adm-hint">
        One personal sentence each, never a summary of the book. The year is free text and hides
        itself when empty.
      </p>

      {books.map((book) => (
        <section className="adm-section" key={book.id}>
          <form action={saveBook.bind(null, book.id)}>
            <label className="adm-field">
              <span>Title</span>
              <input className="adm-input" name="title" defaultValue={book.title} required />
            </label>

            <div className="adm-pair">
              <label className="adm-field">
                <span>Author</span>
                <input className="adm-input" name="author" defaultValue={book.author} />
              </label>
              <label className="adm-field">
                <span>Year read</span>
                <input
                  className="adm-input"
                  name="year"
                  defaultValue={book.year}
                  placeholder="2024"
                />
              </label>
            </div>

            <label className="adm-field">
              <span>Note</span>
              <textarea
                className="adm-area"
                name="note"
                defaultValue={book.note}
                rows={3}
                style={{ minHeight: "6rem" }}
              />
            </label>

            <label className="adm-field">
              <span>Order</span>
              <input
                className="adm-input"
                name="sortOrder"
                type="number"
                defaultValue={book.sortOrder}
                inputMode="numeric"
              />
            </label>

            <div className="adm-buttons" style={{ marginTop: "1.3rem" }}>
              <button className="adm-btn" type="submit">
                Save
              </button>
              <ConfirmButton
                className="adm-btn quiet"
                formAction={deleteBook.bind(null, book.id)}
                message={`Remove “${book.title}” from the list?`}
              >
                Delete
              </ConfirmButton>
            </div>
          </form>
        </section>
      ))}

      <section className="adm-section">
        <h2>Add a book</h2>
        <form action={addBook}>
          <label className="adm-field">
            <span>Title</span>
            <input className="adm-input" name="title" required />
          </label>

          <div className="adm-pair">
            <label className="adm-field">
              <span>Author</span>
              <input className="adm-input" name="author" />
            </label>
            <label className="adm-field">
              <span>Year read</span>
              <input className="adm-input" name="year" placeholder="2026" />
            </label>
          </div>

          <label className="adm-field">
            <span>Note</span>
            <textarea className="adm-area" name="note" rows={3} style={{ minHeight: "6rem" }} />
          </label>

          <div className="adm-buttons" style={{ marginTop: "1.3rem" }}>
            <button className="adm-btn primary" type="submit">
              Add
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
