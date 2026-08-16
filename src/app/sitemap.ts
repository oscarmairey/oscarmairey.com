import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { published } from "@/lib/content";
import { sectionList } from "@/lib/labels";

/** Public routes only: nothing under /admin is listed here, and robots.ts
 *  disallows it besides. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lists = await Promise.all(sectionList.map((spec) => published(spec.section)));

  const home = { url: site.url, lastModified: new Date() };

  /* A list nobody has published into is a page with nothing on it, and an empty
     page is worth less than no page at all in a map this short. The count is
     read rather than written down, so the day a book goes up the list comes
     back on its own. The page itself stays reachable either way. */
  const routes = sectionList.flatMap((spec, i) =>
    lists[i].length ? [{ url: `${site.url}${spec.route}`, lastModified: new Date() }] : [],
  );

  const entries = sectionList.flatMap((spec, i) =>
    lists[i].map((item) => ({
      url: `${site.url}${spec.route}/${item.slug}`,
      lastModified: new Date(`${item.date}T00:00:00Z`),
    })),
  );

  return [home, ...routes, ...entries];
}
