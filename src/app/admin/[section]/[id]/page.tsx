import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getItem } from "@/lib/editor";
import { draftOf, isSection, sections } from "@/lib/labels";
import Editor from "../../editor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ section: string; id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireSession();
  const { section, id } = await params;
  if (!isSection(section)) return { title: "Editor" };

  const row = await getItem(sections[section].label, Number(id));
  return { title: row?.title || sections[section].plural };
}

export default async function EditEntry({ params }: Params) {
  await requireSession();

  const { section, id } = await params;
  if (!isSection(section)) notFound();

  const numeric = Number(id);
  if (!Number.isInteger(numeric)) notFound();

  const row = await getItem(sections[section].label, numeric);
  if (!row) notFound();

  return <Editor initial={draftOf(section, row)} live={row.published} />;
}
