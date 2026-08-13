"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { client, endSession, requireSession, startSession, verifyPassword } from "@/lib/auth";
import { slugify } from "@/lib/blocks";
import * as store from "@/lib/editor";
import { clear, hit } from "@/lib/ratelimit";

/** The public pages render dynamically and read through the cache in
 *  src/lib/content.ts, which every write already invalidates. This clears the
 *  router cache too, so a publish is live on the next navigation, not in
 *  thirty seconds. */
function published() {
  revalidatePath("/", "layout");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function message(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return `Could not reach the database — ${text}`;
}

/* ---- session ------------------------------------------------------------ */

export type LoginState = { error?: string };

export async function signIn(_state: LoginState, form: FormData): Promise<LoginState> {
  const key = await client();
  const verdict = hit(key);
  if (!verdict.ok) {
    return { error: `Too many attempts. Try again in ${verdict.retryAfter} minutes.` };
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return { error: "ADMIN_PASSWORD_HASH is not set on the server." };

  const password = String(form.get("password") ?? "");
  if (!password || !(await verifyPassword(password, hash))) {
    return { error: "Wrong password." };
  }

  clear(key);
  await startSession();
  redirect("/admin");
}

export async function signOut() {
  await endSession();
  redirect("/admin/login");
}

/* ---- writings ----------------------------------------------------------- */

export type Draft = {
  id: number | null;
  title: string;
  subtitle: string;
  slug: string;
  body: string;
  readingTime: string;
  date: string;
};

export type SaveResult = { ok: true; id: number; slug: string } | { ok: false; error: string };

export async function saveWriting(draft: Draft): Promise<SaveResult> {
  await requireSession();

  const title = draft.title.trim();
  const slug = slugify(draft.slug.trim() || title);
  if (!slug) return { ok: false, error: "Give it a title, or a slug, before saving." };

  const input: store.WritingInput = {
    slug,
    title: title || "Untitled",
    subtitle: draft.subtitle.trim(),
    body: draft.body,
    readingTime: draft.readingTime.trim(),
    date: DATE.test(draft.date) ? draft.date : "",
  };

  try {
    let id = draft.id;
    if (id === null) {
      id = await store.createWriting(input);
    } else {
      await store.updateWriting(id, input);
    }
    published();
    return { ok: true, id, slug };
  } catch (error) {
    if (store.isSlugTaken(error)) {
      return { ok: false, error: `The slug “${slug}” already belongs to another writing.` };
    }
    return { ok: false, error: message(error) };
  }
}

export async function setWritingPublished(id: number, publish: boolean): Promise<SaveResult> {
  await requireSession();
  try {
    await store.setPublished(id, publish);
    const row = await store.getWriting(id);
    published();
    return { ok: true, id, slug: row?.slug ?? "" };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function deleteWriting(id: number) {
  await requireSession();
  await store.deleteWriting(id);
  published();
  redirect("/admin");
}

/* ---- companies ---------------------------------------------------------- */

export type CompanyDraft = {
  id: number | null;
  slug: string;
  name: string;
  role: string;
  period: string;
  summary: string;
  body: string;
  url: string;
  sortOrder: number;
};

export async function saveCompany(draft: CompanyDraft): Promise<SaveResult> {
  await requireSession();

  const name = draft.name.trim();
  const slug = slugify(draft.slug.trim() || name);
  if (!slug) return { ok: false, error: "Give it a name, or a slug, before saving." };

  const input: store.CompanyInput = {
    slug,
    name: name || "Untitled",
    role: draft.role.trim(),
    period: draft.period.trim(),
    summary: draft.summary.trim(),
    body: draft.body,
    url: draft.url.trim(),
    sortOrder: Number.isFinite(draft.sortOrder) ? Math.trunc(draft.sortOrder) : 0,
  };

  try {
    let id = draft.id;
    if (id === null) {
      id = await store.createCompany(input);
    } else {
      await store.updateCompany(id, input);
    }
    published();
    return { ok: true, id, slug };
  } catch (error) {
    if (store.isSlugTaken(error)) {
      return { ok: false, error: `The slug “${slug}” already belongs to another company.` };
    }
    return { ok: false, error: message(error) };
  }
}

export async function deleteCompany(id: number) {
  await requireSession();
  await store.deleteCompany(id);
  published();
  redirect("/admin/companies");
}

/* ---- books -------------------------------------------------------------- */

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function addBook(form: FormData) {
  await requireSession();
  const title = text(form, "title");
  if (!title) return;

  await store.createBook({
    title,
    author: text(form, "author"),
    year: text(form, "year"),
    note: text(form, "note"),
  });
  published();
  revalidatePath("/admin/books");
}

export async function saveBook(id: number, form: FormData) {
  await requireSession();
  await store.updateBook(id, {
    title: text(form, "title"),
    author: text(form, "author"),
    year: text(form, "year"),
    note: text(form, "note"),
    sortOrder: Number(text(form, "sortOrder")) || 0,
  });
  published();
  revalidatePath("/admin/books");
}

export async function deleteBook(id: number) {
  await requireSession();
  await store.deleteBook(id);
  published();
  revalidatePath("/admin/books");
}
