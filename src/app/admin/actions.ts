"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { client, requireSession, startSession, verifyPassword } from "@/lib/auth";
import { imageNames, readingTime, slugify } from "@/lib/blocks";
import * as store from "@/lib/editor";
import { isSection, sections, type Draft, type Section } from "@/lib/labels";
import { clear, hit } from "@/lib/ratelimit";
import { forget } from "@/lib/uploads";

/** The public pages render dynamically and read through the cache in
 *  src/lib/content.ts, which every write already invalidates. This clears the
 *  router cache too, so a publish is live on the next navigation, not in
 *  thirty seconds.
 *
 *  One page, not the layout: revalidating from the root takes /admin with it,
 *  and Next answers an action by re-rendering the page that called it — which
 *  is the editor, with somebody typing in it. Every public page is dynamic and
 *  reads the database on request anyway, so this is only about the router cache
 *  in Oscar's own tab. */
function published() {
  revalidatePath("/");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** An entry that stops mentioning an image takes the file with it, unless some
 *  other entry still refers to it. Called after the write, so the database is
 *  already telling the truth, and never allowed to fail: an orphaned file is a
 *  smaller problem than a save that did not happen. */
async function sweep(before: string, after: string) {
  try {
    const dropped = imageNames(before).filter((name) => !imageNames(after).includes(name));
    for (const name of dropped) {
      if (!(await store.bodyUses(name))) await forget(name);
    }
  } catch (error) {
    console.error(`[media] could not sweep: ${(error as Error).message}`);
  }
}

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

/* ---- one editor, three labels ------------------------------------------- */

/** The date comes back because publishing can create one: the server stamps a
 *  row the first time it goes live, and an editor still holding "" would wipe
 *  it on the next save. */
export type SaveResult = { ok: true; id: number; date: string } | { ok: false; error: string };

export async function saveItem(draft: Draft): Promise<SaveResult> {
  await requireSession();

  /* A server action is a public endpoint: the section arrives as a string from
     the network and is checked here rather than trusted. */
  const { section } = draft;
  if (!isSection(section)) return { ok: false, error: "Unknown kind of entry." };
  const spec = sections[section];

  const title = draft.title.trim();

  try {
    /* The slug is never typed. It follows the title while the entry is still
       only Oscar's, and freezes the moment a reader can reach it: a published
       address is a promise. */
    const current = draft.id === null ? undefined : await store.getItem(spec.label, draft.id);
    if (draft.id !== null && !current) return { ok: false, error: "That entry is gone." };

    const slug = current?.published
      ? current.slug
      : await store.freeSlug(spec.label, slugify(title) || current?.slug || spec.one, draft.id);

    const input: Draft = {
      ...draft,
      section,
      title: title || "Untitled",
      subtitle: draft.subtitle.trim(),
      byline: draft.byline.trim(),
      period: draft.period.trim(),
      /* Computed, not typed: it cannot disagree with what is written. */
      readingTime: spec.label === "note" ? readingTime(draft.body) : "",
      date: DATE.test(draft.date) ? draft.date : "",
    };

    const id = draft.id === null ? await store.createItem(slug, input) : draft.id;
    if (draft.id !== null) await store.updateItem(id, slug, input);

    if (current) await sweep(current.body, input.body);
    published();
    return { ok: true, id, date: input.date };
  } catch (error) {
    if (store.isSlugTaken(error)) {
      return { ok: false, error: `Two ${spec.plural.toLowerCase()} are fighting over one address.` };
    }
    return { ok: false, error: message(error) };
  }
}

export async function setItemPublished(
  section: string,
  id: number,
  publish: boolean,
): Promise<SaveResult> {
  await requireSession();

  if (!isSection(section)) return { ok: false, error: "Unknown kind of entry." };

  try {
    await store.setPublished(id, publish);
    /* Read back for the date: the first publish stamps a row that had none. */
    const row = await store.getItem(sections[section].label, id);
    published();
    return { ok: true, id, date: row?.date ?? "" };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function deleteItem(section: string, id: number) {
  await requireSession();

  if (!isSection(section)) return;

  const going = await store.getItem(sections[section].label, id);
  await store.deleteItem(sections[section].label, id);
  if (going) await sweep(going.body, "");
  published();
  revalidatePath(`/admin/${section}`);
  redirect(`/admin/${section}`);
}
