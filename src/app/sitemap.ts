import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { publicCompanies, publishedWritings } from "@/lib/content";

/** Public routes only: nothing under /admin is listed here, and robots.ts
 *  disallows it besides. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [writings, companies] = await Promise.all([publishedWritings(), publicCompanies()]);

  const routes = ["", "/writings", "/books", "/building"].map((path) => ({
    url: `${site.url}${path}`,
    lastModified: new Date(),
  }));

  const posts = writings.map((w) => ({
    url: `${site.url}/writings/${w.slug}`,
    lastModified: new Date(`${w.date}T00:00:00Z`),
  }));

  const record = companies.map((c) => ({
    url: `${site.url}/building/${c.slug}`,
    lastModified: new Date(),
  }));

  return [...routes, ...posts, ...record];
}
