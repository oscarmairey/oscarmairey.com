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
 *  it on the next save. The version comes back for the same reason: the first
 *  save of a new entry is also what makes its v1. */
export type SaveResult =
  | { ok: true; id: number; versionId: number; date: string; slug: string }
  | { ok: false; error: string };

export async function saveItem(draft: Draft): Promise<SaveResult> {
  await requireSession();

  /* A server action is a public endpoint: the section arrives as a string from
     the network and is checked here rather than trusted. */
  const { section } = draft;
  if (!isSection(section)) return { ok: false, error: "Unknown kind of entry." };
  const spec = sections[section];

  const title = draft.title.trim();

  try {
    const current = draft.id === null ? undefined : await store.getEntry(spec.label, draft.id);
    if (draft.id !== null && !current) return { ok: false, error: "That entry is gone." };

    /* The version this save is for, named by the editor rather than looked up:
       switching versions is a remount, and a save already in the air belongs to
       the version it was typed into. Checked against the entry, because a
       server action is a public endpoint. */
    const version =
      current && draft.versionId !== null
        ? await store.getVersion(current.id, draft.versionId)
        : undefined;
    if (current && !version) return { ok: false, error: "That version is gone." };

    /* The slug is never typed. It follows the title of the version a reader
       would get, while the entry is still only Oscar's, and freezes the moment
       a reader can reach it: a published address is a promise. Retyping a
       version nobody is being shown moves nothing. */
    const slug = !current
      ? await store.freeSlug(spec.label, slugify(title) || spec.one, null)
      : current.published || version!.id !== current.liveVersionId
        ? current.slug
        : await store.freeSlug(spec.label, slugify(title) || current.slug || spec.one, draft.id);

    const input: Draft = {
      ...draft,
      section,
      title: title || "Untitled",
      subtitle: draft.subtitle.trim(),
      byline: draft.byline.trim(),
      period: draft.period.trim(),
      /* Computed, not typed, and computed per version: two versions of a note
         are two lengths, and each says its own. */
      readingTime: spec.label === "note" ? readingTime(draft.body) : "",
      date: DATE.test(draft.date) ? draft.date : "",
    };

    if (!current) {
      const made = await store.createItem(slug, input);
      return { ok: true, id: made.id, versionId: made.versionId, date: input.date, slug };
    }

    await store.updateItem(current.id, version!.id, slug, input);
    await sweep(version!.body, input.body);

    /* No revalidation here. A save happens every few seconds while Oscar is
       typing, and Next answers an action by re-rendering the page that called
       it — which would remount the editor under him and throw away whatever the
       browser had put in the document since. Nothing public needs it: the pages
       are dynamic, they read on request, and the write already emptied the
       cache they read through. Publishing and deleting revalidate, because
       those are the moments a list changes. */
    return { ok: true, id: current.id, versionId: version!.id, date: input.date, slug };
  } catch (error) {
    if (store.isSlugTaken(error)) {
      return { ok: false, error: `Two ${spec.plural.toLowerCase()} are fighting over one address.` };
    }
    return { ok: false, error: message(error) };
  }
}

/* ---- versions ------------------------------------------------------------ */

/** Another go at the same entry, starting from the one on screen: a rewrite
 *  begins with what is already written, and what it does not keep it deletes.
 *  It does not go live by being made. */
export type VersionResult = { ok: true; id: number; n: number } | { ok: false; error: string };

export async function addVersion(
  section: string,
  id: number,
  from: number,
): Promise<VersionResult> {
  await requireSession();

  if (!isSection(section)) return { ok: false, error: "Unknown kind of entry." };
  if (!Number.isInteger(id) || !Number.isInteger(from)) {
    return { ok: false, error: "That is not a version." };
  }

  try {
    const entry = await store.getEntry(sections[section].label, id);
    if (!entry) return { ok: false, error: "That entry is gone." };

    const made = await store.addVersion(id, from);
    if (!made) return { ok: false, error: "There is no such version to copy." };

    return { ok: true, id: made.id, n: made.n };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** One version thrown away, and only one: the entry stays, its address stays,
 *  and every other version of it stays. Never the version the site is showing —
 *  a reader's page must always have words behind it — which also means the last
 *  version of an entry cannot go this way. The whole entry is deleted by the
 *  press that says so. */
export async function deleteVersion(
  section: string,
  id: number,
  versionId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();

  if (!isSection(section)) return { ok: false, error: "Unknown kind of entry." };
  if (!Number.isInteger(id) || !Number.isInteger(versionId)) {
    return { ok: false, error: "That is not a version." };
  }
  const spec = sections[section];

  try {
    const entry = await store.getEntry(spec.label, id);
    if (!entry) return { ok: false, error: "That entry is gone." };

    const version = await store.getVersion(id, versionId);
    if (!version) return { ok: false, error: "That version is gone." };

    if (versionId === entry.liveVersionId) {
      return {
        ok: false,
        error: `That is the version the site is showing. Make another one live first.`,
      };
    }

    if (!(await store.deleteVersion(id, versionId))) {
      return { ok: false, error: "That version did not go." };
    }

    /* What it referred to and nothing else does goes with it. */
    await sweep(version.body, "");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** Which version a reader gets. A press of its own, weighed the same as
 *  publishing, because it is the same kind of decision: it changes what is on
 *  the site. Nothing else moves it — not saving, not making a newer one. */
export async function setLiveVersion(
  section: string,
  id: number,
  versionId: number,
): Promise<SaveResult> {
  await requireSession();

  if (!isSection(section)) return { ok: false, error: "Unknown kind of entry." };
  const spec = sections[section];

  try {
    const entry = await store.getEntry(spec.label, id);
    if (!entry) return { ok: false, error: "That entry is gone." };

    const version = await store.getVersion(id, versionId);
    if (!version) return { ok: false, error: "That version is gone." };

    await store.setLive(id, versionId);

    /* The address follows the live version's title, and stops the day a reader
       can reach it — the same rule as a save, applied at the other moment that
       can change which title is the live one. */
    let slug = entry.slug;
    if (!entry.published) {
      slug = await store.freeSlug(
        spec.label,
        slugify(version.title.trim()) || entry.slug || spec.one,
        id,
      );
      if (slug !== entry.slug) await store.setSlug(id, slug);
    }

    /* Only when a reader is affected, which is also the only case where this is
       safe: revalidating makes Next re-render the page that called the action,
       and on a draft that is the editor at an address this press may have just
       moved. Nothing public changes when nothing was public. */
    if (entry.published) published();

    return { ok: true, id, versionId, date: entry.date, slug };
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
    const row = await store.getEntry(sections[section].label, id);
    published();
    return {
      ok: true,
      id,
      versionId: row?.liveVersionId ?? 0,
      date: row?.date ?? "",
      slug: row?.slug ?? "",
    };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** The order of a list, as dragged. The ids are checked for shape and the
 *  update is scoped to the label, so a bad list cannot move somebody else's. */
export async function reorderItems(
  section: string,
  ids: number[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();

  if (!isSection(section)) return { ok: false, error: "Unknown kind of entry." };
  if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id))) {
    return { ok: false, error: "That is not an order." };
  }

  try {
    await store.reorder(sections[section].label, ids);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** The bio saves like an entry does: on its own, a few seconds after the typing
 *  stops, and without revalidating anything — the home page is dynamic and reads
 *  through the cache this write has already emptied. */
export async function saveBio(value: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();
  try {
    await store.setBio(value.trim());
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/* There is no way to delete an entry. Unpublishing takes it off the site and
   keeps it, which is what taking something down actually means; a version that
   is not the live one can be thrown away, and that is as much as anything here
   destroys. The action that deleted a whole entry is gone rather than hidden,
   so there is nothing left to call. */
