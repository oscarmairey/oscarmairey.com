import { site } from "@/content/site";
import { published } from "@/lib/content";
import { plain } from "@/lib/inline";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Built per request from the same cache the pages read, so a publish appears
 *  in the feed without a deploy. */
export const dynamic = "force-dynamic";

/** Notes only. A book and a company are a record, not a publication. */
export async function GET() {
  const notes = await published("notes");

  const items = notes
    .map((w) => {
      const url = `${site.url}/notes/${w.slug}`;
      return `    <item>
      <title>${escape(w.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(`${w.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escape(plain(w.subtitle))}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(site.name)}</title>
    <link>${site.url}</link>
    <description>${escape(site.description)}</description>
    <language>en</language>
    <atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
