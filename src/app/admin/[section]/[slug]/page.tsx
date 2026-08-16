import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { openBySlug } from "@/lib/editor";
import { draftOf, isSection, sections } from "@/lib/labels";
import Editor from "../../editor";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ section: string; slug: string }>;
  /** Which version is open: `?v=2`, and the live one when nothing says. */
  searchParams: Promise<{ v?: string }>;
};

/** The number in the address, or nothing. A version that is not there falls
 *  back to the live one further down, so a stale link opens the entry rather
 *  than a page that does not exist. */
function asked(v: string | undefined): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  await requireSession();
  const { section, slug } = await params;
  if (!isSection(section)) return { title: "Editor" };

  const row = await openBySlug(sections[section].label, slug, asked((await searchParams).v));
  return { title: row?.title || sections[section].plural };
}

export default async function EditEntry({ params, searchParams }: Params) {
  await requireSession();

  const { section, slug } = await params;
  if (!isSection(section)) notFound();

  const row = await openBySlug(sections[section].label, slug, asked((await searchParams).v));
  if (!row) notFound();

  /* Keyed on the version, so switching to another one is a real mount: the
     editor writes a region's content exactly once and never touches it again,
     which is what keeps the caret still, and the only honest way to put
     different words on the page is a new one. */
  return (
    <Editor
      key={row.versionId}
      initial={draftOf(section, row)}
      live={row.published}
      slug={row.slug}
      versions={row.versions}
      liveVersionId={row.liveVersionId}
    />
  );
}
