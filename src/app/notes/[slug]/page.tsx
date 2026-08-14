import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Entry from "@/components/site/entry";
import { published, publishedOne } from "@/lib/content";
import { entryMetadata } from "@/lib/meta";

type Params = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return entryMetadata("notes", await publishedOne("notes", slug));
}

export default async function NotePage({ params }: Params) {
  const { slug } = await params;
  const note = await publishedOne("notes", slug);
  if (!note) notFound();

  const all = await published("notes");
  return <Entry section="notes" item={note} list={all} />;
}
