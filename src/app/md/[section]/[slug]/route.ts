import { site } from "@/content/site";
import { publishedOne } from "@/lib/content";
import { isSection } from "@/lib/labels";
import { entryMarkdown } from "@/lib/markdown";

/** One entry as markdown.
 *
 *  Under /md/ rather than as a `.md` on the entry's own address: a suffix on a
 *  dynamic segment is not something the router does, and the catch-all it would
 *  take stands in front of the page it is meant to accompany. So the shape is
 *  /md/<list>/<slug> beside /<list>/<slug>, and every entry page points at its
 *  own with a <link rel="alternate" type="text/markdown">. */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ section: string; slug: string }> },
) {
  const { section, slug } = await params;
  if (!isSection(section)) return new Response("Not found", { status: 404 });

  const item = await publishedOne(section, slug);
  if (!item) return new Response("Not found", { status: 404 });

  return new Response(entryMarkdown(section, item, site.url), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "x-robots-tag": "all",
    },
  });
}
