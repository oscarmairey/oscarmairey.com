import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { published } from "@/content/writings";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/writings", "/books", "/building"].map((path) => ({
    url: `${site.url}${path}`,
    lastModified: new Date(),
  }));

  const posts = published.map((w) => ({
    url: `${site.url}/writings/${w.slug}`,
    lastModified: new Date(`${w.date}T00:00:00Z`),
  }));

  return [...routes, ...posts];
}
