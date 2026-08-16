import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { emptyDraft, isSection, sections } from "@/lib/labels";
import Editor from "../../editor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { section } = await params;
  return { title: isSection(section) ? `New ${sections[section].one}` : "Editor" };
}

/** No row is created until the first save, so opening this page and walking
 *  away leaves nothing behind — and no version either, so there is nothing yet
 *  for the version line to name. */
export default async function NewEntry({ params }: Params) {
  await requireSession();

  const { section } = await params;
  if (!isSection(section)) notFound();

  return (
    <Editor initial={emptyDraft(section)} live={false} slug="" versions={[]} liveVersionId={0} />
  );
}
