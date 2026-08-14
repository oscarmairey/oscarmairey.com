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

/** A value that is not part of the page the reader sees, or is derived into the
 *  stamp rather than typed into it. Everything else is edited in place. */
export type Field = {
  key: keyof Omit<Draft, "id" | "section" | "slug" | "title" | "subtitle" | "body">;
  label: string;
  kind?: "date" | "number";
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
  /** What the title reads as when it is empty. A company has a name. */
  name: string;
  /** What the line under the title reads as when it is empty. */
  sub: string;
  /** Only a note is ever a draft. */
  draftable: boolean;
  /** Books and companies are placed by hand. A note is placed by its date. */
  ordered: boolean;
  meta: (item: Item) => Meta;
  stamp: (item: Item) => ReactNode;
  /** The one row of metadata under the page in the editor. */
  fields: Field[];
};

export const sections: Record<Section, Spec> = {
  notes: {
    label: "note",
    section: "notes",
    plural: "Notes",
    one: "note",
    route: "/notes",
    name: "Title",
    sub: "The one sentence that gives the angle.",
    draftable: true,
    ordered: false,
    meta: (item) => ({ text: item.date ? formatMonth(item.date) : "", dateTime: item.date }),
    stamp: (item) => (
      <>
        {item.date ? <time dateTime={item.date}>{formatDay(item.date)}</time> : "Undated"}
        {item.readingTime && ` · ${item.readingTime}`}
      </>
    ),
    fields: [{ key: "date", label: "Date", kind: "date" }],
  },

  books: {
    label: "book",
    section: "books",
    plural: "Books",
    one: "book",
    route: "/books",
    name: "Title",
    sub: "Why it stayed. One personal sentence, never a summary of the book.",
    draftable: false,
    ordered: true,
    meta: (item) => ({ text: item.year }),
    stamp: (item) => item.year,
    fields: [
      { key: "byline", label: "Author" },
      { key: "year", label: "Year read" },
      { key: "sortOrder", label: "Order", kind: "number" },
    ],
  },

  companies: {
    label: "company",
    section: "companies",
    plural: "Companies",
    one: "company",
    route: "/companies",
    name: "Name",
    sub: "The one line the lists show.",
    draftable: false,
    ordered: true,
    meta: (item) => ({ text: item.period }),
    stamp: (item) => [item.period, item.byline].filter(Boolean).join(" · "),
    fields: [
      { key: "byline", label: "Role" },
      { key: "period", label: "Period" },
      { key: "url", label: "Link" },
      { key: "sortOrder", label: "Order", kind: "number" },
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
