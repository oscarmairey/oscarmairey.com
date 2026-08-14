import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getBySlug } from "@/lib/editor";
import { draftOf, isSection, sections } from "@/lib/labels";
import Editor from "../../editor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ section: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireSession();
  const { section, slug } = await params;
  if (!isSection(section)) return { title: "Editor" };

  const row = await getBySlug(sections[section].label, slug);
  return { title: row?.title || sections[section].plural };
}

export default async function EditEntry({ params }: Params) {
  await requireSession();

  const { section, slug } = await params;
  if (!isSection(section)) notFound();

  const row = await getBySlug(sections[section].label, slug);
  if (!row) notFound();

  return <Editor initial={draftOf(section, row)} live={row.published} slug={row.slug} />;
}

