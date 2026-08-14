import type { Metadata } from "next";
import { site } from "@/content/site";
import { plain } from "@/lib/inline";
import type { Item, Section } from "@/lib/labels";
import { sections } from "@/lib/labels";

/** The head of every entry page, written once. A missing row returns nothing
 *  and the page itself calls notFound(). */
export function entryMetadata(section: Section, item: Item | undefined): Metadata {
  if (!item) return {};

  const path = `${sections[section].route}/${item.slug}`;
  const description = plain(item.subtitle);

  return {
    title: item.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: item.title,
      description,
      url: `${site.url}${path}`,
      ...(section === "notes" && item.date ? { publishedTime: item.date } : {}),
    },
    twitter: { card: "summary_large_image", title: item.title, description },
  };
}
