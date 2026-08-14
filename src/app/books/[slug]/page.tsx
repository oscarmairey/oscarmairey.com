import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Entry from "@/components/site/entry";
import { published, publishedOne } from "@/lib/content";
import { entryMetadata } from "@/lib/meta";

type Params = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return entryMetadata("books", await publishedOne("books", slug));
}

/** The title, the year it was read and the reason it stayed. The author is
 *  stored and stays out of the page, the same way it stays out of the list. */
export default async function BookPage({ params }: Params) {
  const { slug } = await params;
  const book = await publishedOne("books", slug);
  if (!book) notFound();

  const all = await published("books");
  return <Entry section="books" item={book} list={all} />;
}
