import { site } from "@/content/site";
import { bio, published } from "@/lib/content";
import { sectionList } from "@/lib/labels";
import { entryMarkdown } from "@/lib/markdown";

/** The whole site as one markdown document: every published entry, in the order
 *  Oscar put them in, body and all. Same cache, same absence of drafts. */
export const dynamic = "force-dynamic";

export async function GET() {
  const [line, lists] = await Promise.all([
    bio(),
    Promise.all(sectionList.map((spec) => published(spec.section))),
  ]);

  const parts = [`# ${site.name}`, "", `> ${line}`, "", `Source: ${site.url}`];

  sectionList.forEach((spec, i) => {
    const items = lists[i];
    if (items.length === 0) return;

    parts.push("", "---", "", `# ${spec.plural}`);
    for (const item of items) {
      parts.push("", "---", "", entryMarkdown(spec.section, item, site.url).trimEnd());
    }
  });

  return new Response(parts.join("\n") + "\n", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
