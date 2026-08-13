import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    /* The editor is noindex in its own metadata as well: a crawler that ignores
       one is stopped by the other. */
    rules: { userAgent: "*", allow: "/", disallow: "/admin" },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
