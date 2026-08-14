import type { ReactNode } from "react";
import { formatDay, formatMonth } from "@/lib/format";

/** One table, three labels, one vocabulary for all of it.
 *
 *  Everything that differs between a note, a book and a company is here: the
 *  word the nav prints, the route it lives on, the metadata a list line carries,
 *  the metadata a page carries, and the fields the editor shows. Everything else
 *  — the queries, the list, the page, the editor — is written once against this.
 *
 *  This module is pure on purpose. The database layer imports it, the public
 *  pages import it and so does the client editor, so it must not reach for
 *  Postgres, cookies or anything else that only exists on the server. */

export type Label = "note" | "book" | "company";

/** The URL segment, which is also the plural: /notes, /books, /companies, and
 *  /admin/notes, /admin/books, /admin/companies. */
export type Section = "notes" | "books" | "companies";

/** A row of the table, as everything above the database reads it.
 *
 *    title     the title, or the company's name
 *    subtitle  the one line the lists print: the angle, the reason, the summary
 *    byline    a book's author, a company's role
 *    body      long form, in the block format of src/lib/blocks.ts */
export type Item = {
  id: number;
  label: Label;
  slug: string;
  title: string;
  subtitle: string;
  byline: string;
  body: string;
  year: string;
  period: string;
  url: string;
  readingTime: string;
  /** ISO day in UTC, "" when the row has never been dated. */
  date: string;
};

/** What the editor reads: an item, plus the two things only it cares about. */
export type Row = Item & { published: boolean; sortOrder: number };

/** What the editor writes. `id` is null until the first save. */
export type Draft = {
  id: number | null;
  section: Section;
  slug: string;
  title: string;
  subtitle: string;
  byline: string;
  body: string;
  year: string;
  period: string;
  url: string;
  readingTime: string;
  date: string;
  sortOrder: number;
};

export type Field = {
  key: keyof Omit<Draft, "id" | "section" | "slug" | "title">;
  label: string;
  placeholder?: string;
  kind?: "date" | "number" | "area";
};

/** The metadata a list line carries, right of the title. A note's is a date, so
 *  it comes with the machine-readable day that goes in <time datetime>. */
export type Meta = { text: string; dateTime?: string };

export type Spec = {
  label: Label;
  section: Section;
  /** The word the nav and the headings print. */
  plural: string;
  /** The word a button prints: "New note". */
  one: string;
  /** The public route. The admin route is the same under /admin. */
  route: string;
  /** What the first field is called. A company has a name, not a title. */
  name: string;
  /** Only a note is ever a draft. */
  draftable: boolean;
  /** Books and companies are placed by hand. A note is placed by its date. */
  ordered: boolean;
  /** The sentence under the editor's own title. */
  hint: string;
  meta: (item: Item) => Meta;
  stamp: (item: Item) => ReactNode;
  rows: Field[][];
};

const BODY = "One blank line between paragraphs.";

export const sections: Record<Section, Spec> = {
  notes: {
    label: "note",
    section: "notes",
    plural: "Notes",
    one: "note",
    route: "/notes",
    name: "Title",
    draftable: true,
    ordered: false,
    hint: "Only you can see this until you publish it. It saves itself as you type.",
    meta: (item) => ({ text: item.date ? formatMonth(item.date) : "", dateTime: item.date }),
    stamp: (item) => (
      <>
        {item.date ? <time dateTime={item.date}>{formatDay(item.date)}</time> : "Undated"}
        {item.readingTime && ` · ${item.readingTime}`}
      </>
    ),
    rows: [
      [{ key: "subtitle", label: "Subtitle", placeholder: "The one sentence that gives the angle." }],
      [
        { key: "date", label: "Date", kind: "date" },
        { key: "readingTime", label: "Reading time", placeholder: "9 min" },
      ],
      [{ key: "body", label: "Body", kind: "area", placeholder: BODY }],
    ],
  },

  books: {
    label: "book",
    section: "books",
    plural: "Books",
    one: "book",
    route: "/books",
    name: "Title",
    draftable: false,
    ordered: true,
    hint: "This is live the moment you save it. The note is the line the lists show; the author is stored and never printed.",
    meta: (item) => ({ text: item.year }),
    stamp: (item) => item.year,
    rows: [
      [
        {
          key: "subtitle",
          label: "Note",
          placeholder: "One personal sentence, never a summary of the book.",
        },
      ],
      [
        { key: "byline", label: "Author" },
        { key: "year", label: "Year read", placeholder: "2026" },
      ],
      [{ key: "sortOrder", label: "Order", kind: "number" }],
      [
        {
          key: "body",
          label: "Body",
          kind: "area",
          placeholder: `${BODY} Leave it empty and the page shows the note.`,
        },
      ],
    ],
  },

  companies: {
    label: "company",
    section: "companies",
    plural: "Companies",
    one: "company",
    route: "/companies",
    name: "Name",
    draftable: false,
    ordered: true,
    hint: "This is live the moment you save it. The summary is the line the lists show; the body is the page itself.",
    meta: (item) => ({ text: item.period }),
    stamp: (item) => [item.period, item.byline].filter(Boolean).join(" · "),
    rows: [
      [
        { key: "byline", label: "Role", placeholder: "What you did there" },
        { key: "period", label: "Period", placeholder: "2024–2025, or Now" },
      ],
      [{ key: "subtitle", label: "Summary", placeholder: "The one line the lists show." }],
      [
        { key: "url", label: "Link", placeholder: "https://example.com" },
        { key: "sortOrder", label: "Order", kind: "number" },
      ],
      [
        {
          key: "body",
          label: "Body",
          kind: "area",
          placeholder: `${BODY} Leave it empty and the page shows the summary.`,
        },
      ],
    ],
  },
};

export const sectionList = Object.values(sections);

export function isSection(value: string): value is Section {
  return value === "notes" || value === "books" || value === "companies";
}

export const emptyDraft = (section: Section, sortOrder = 0): Draft => ({
  id: null,
  section,
  slug: "",
  title: "",
  subtitle: "",
  byline: "",
  body: "",
  year: "",
  period: "",
  url: "",
  readingTime: "",
  date: "",
  sortOrder,
});

export const draftOf = (section: Section, row: Row): Draft => ({
  id: row.id,
  section,
  slug: row.slug,
  title: row.title,
  subtitle: row.subtitle,
  byline: row.byline,
  body: row.body,
  year: row.year,
  period: row.period,
  url: row.url,
  readingTime: row.readingTime,
  date: row.date,
  sortOrder: row.sortOrder,
});

/** A draft is an item as far as the preview and the stamp are concerned. */
export const itemOf = (draft: Draft): Item => ({
  ...draft,
  id: draft.id ?? 0,
  label: sections[draft.section].label,
});
