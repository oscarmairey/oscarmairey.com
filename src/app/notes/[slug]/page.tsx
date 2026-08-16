import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Entry from "@/components/site/entry";
import { site } from "@/content/site";
import { imageNames } from "@/lib/blocks";
import { published, publishedOne } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
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

  /* Only what is true of the row: a title, the day it went up, who wrote it,
     where it lives, and the first image if it has one. */
  const image = imageNames(note.body)[0];
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: note.title,
    ...(note.subtitle ? { description: note.subtitle } : {}),
    ...(note.date ? { datePublished: note.date } : {}),
    ...(image ? { image: `${site.url}${mediaUrl(image)}` } : {}),
    author: { "@type": "Person", name: site.name, url: site.url },
    publisher: { "@type": "Person", name: site.name, url: site.url },
    url: `${site.url}/notes/${note.slug}`,
    mainEntityOfPage: `${site.url}/notes/${note.slug}`,
    inLanguage: "en",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
      />
      <Entry section="notes" item={note} list={all} />
    </>
  );
}
