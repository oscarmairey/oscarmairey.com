"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { client, endSession, requireSession, startSession, verifyPassword } from "@/lib/auth";
import { slugify } from "@/lib/blocks";
import * as store from "@/lib/editor";
import { isSection, sections, type Draft, type Section } from "@/lib/labels";
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

/* ---- one editor, three labels ------------------------------------------- */

export type SaveResult = { ok: true; id: number; slug: string } | { ok: false; error: string };

/** A server action is a public endpoint, so the section arrives as a string
 *  from the network and is checked here rather than trusted. */
function asSection(value: string): Section | null {
  return isSection(value) ? value : null;
}

export async function saveItem(draft: Draft): Promise<SaveResult> {
  await requireSession();

  const section = asSection(draft.section);
  if (!section) return { ok: false, error: "Unknown kind of entry." };
  const spec = sections[section];

  const title = draft.title.trim();
  const slug = slugify(draft.slug.trim() || title);
  if (!slug) {
    return { ok: false, error: `Give it a ${spec.name.toLowerCase()}, or a slug, before saving.` };
  }

  const input: Draft = {
    ...draft,
    section,
    slug,
    title: title || "Untitled",
    subtitle: draft.subtitle.trim(),
    byline: draft.byline.trim(),
    year: draft.year.trim(),
    period: draft.period.trim(),
    url: draft.url.trim(),
    readingTime: draft.readingTime.trim(),
    date: DATE.test(draft.date) ? draft.date : "",
    sortOrder: Number.isFinite(draft.sortOrder) ? Math.trunc(draft.sortOrder) : 0,
  };

  try {
    let id = draft.id;
    if (id === null) {
      id = await store.createItem(input);
    } else {
      await store.updateItem(id, input);
    }
    published();
    return { ok: true, id, slug };
  } catch (error) {
    if (store.isSlugTaken(error)) {
      return { ok: false, error: `The slug “${slug}” already belongs to another ${spec.one}.` };
    }
    return { ok: false, error: message(error) };
  }
}

/** Notes only: nothing else has a draft state to leave. */
export async function setItemPublished(
  section: string,
  id: number,
  publish: boolean,
): Promise<SaveResult> {
  await requireSession();

  const target = asSection(section);
  if (!target || !sections[target].draftable) {
    return { ok: false, error: "That kind of entry has no draft state." };
  }

  try {
    await store.setPublished(id, publish);
    const row = await store.getItem(sections[target].label, id);
    published();
    return { ok: true, id, slug: row?.slug ?? "" };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function deleteItem(section: string, id: number) {
  await requireSession();

  const target = asSection(section);
  if (!target) return;

  await store.deleteItem(sections[target].label, id);
  published();
  revalidatePath(`/admin/${target}`);
  redirect(`/admin/${target}`);
}
