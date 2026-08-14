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

  const routes = sectionList.map((spec) => ({
    url: `${site.url}${spec.route}`,
    lastModified: new Date(),
  }));

  const entries = sectionList.flatMap((spec, i) =>
    lists[i].map((item) => ({
      url: `${site.url}${spec.route}/${item.slug}`,
      lastModified: new Date(`${item.date}T00:00:00Z`),
    })),
  );

  return [home, ...routes, ...entries];
}
