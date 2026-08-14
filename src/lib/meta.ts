import type { Metadata } from "next";
import { site } from "@/content/site";
import { plain } from "@/lib/inline";
import type { Item, Section } from "@/lib/labels";
import { sections } from "@/lib/labels";

/** Where a page says it lives, and where the feed lives.
 *
 *  Next replaces whole metadata fields rather than merging them, so a page that
 *  names its own canonical drops whatever `alternates` the layout had — which
 *  is how every page but the home page quietly lost the feed link. */
export const alternatesFor = (canonical: string) => ({
  canonical,
  types: { "application/rss+xml": [{ url: "/feed.xml", title: site.name }] },
});

/** The head of every entry page, written once. A missing row returns nothing
 *  and the page itself calls notFound(). */
export function entryMetadata(section: Section, item: Item | undefined): Metadata {
  if (!item) return {};

  const path = `${sections[section].route}/${item.slug}`;
  const description = plain(item.subtitle);

  return {
    title: item.title,
    description,
    alternates: alternatesFor(path),
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
