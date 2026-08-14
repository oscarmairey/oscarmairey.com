import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { nextOrder } from "@/lib/editor";
import { emptyDraft, isSection, sections } from "@/lib/labels";
import Editor from "../../editor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { section } = await params;
  return { title: isSection(section) ? `New ${sections[section].one}` : "Editor" };
}

/** No row is created until the first save, so opening this page and walking
 *  away leaves nothing behind. An ordered label reads its next place now, so a
 *  new row lands at the end of the list rather than at the top of it. */
export default async function NewEntry({ params }: Params) {
  await requireSession();

  const { section } = await params;
  if (!isSection(section)) notFound();

  const spec = sections[section];
  const sortOrder = spec.ordered ? await nextOrder(spec.label) : 0;

  return <Editor initial={emptyDraft(section, sortOrder)} live={false} />;
}
