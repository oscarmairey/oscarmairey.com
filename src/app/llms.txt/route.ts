import { site } from "@/content/site";
import { bio, published } from "@/lib/content";
import { sectionList } from "@/lib/labels";
import { entryLine } from "@/lib/markdown";

/** A map of the site for a machine reading it on somebody's behalf.
 *
 *  Read from the same cache the pages read, so it is never staler than they
 *  are and a draft is as absent here as it is everywhere else. */
export const dynamic = "force-dynamic";

export async function GET() {
  const [line, lists] = await Promise.all([
    bio(),
    Promise.all(sectionList.map((spec) => published(spec.section))),
  ]);

  const parts = [
    `# ${site.name}`,
    "",
    `> ${line}`,
    "",
    `Three lists: what he has written, what he has read, what he has built. Every entry on`,
    `this page is also available as markdown at ${site.url}/md/<list>/<slug>, and all of it`,
    `at once at ${site.url}/llms-full.txt.`,
  ];

  sectionList.forEach((spec, i) => {
    const items = lists[i];
    parts.push("", `## ${spec.plural}`, "");
    parts.push(
      items.length > 0
        ? items.map((item) => entryLine(spec.section, item, site.url)).join("\n")
        : `Nothing published yet.`,
    );
  });

  parts.push(
    "",
    "## More",
    "",
    `- [Everything, in full](${site.url}/llms-full.txt)`,
    `- [Notes as a feed](${site.url}/feed.xml)`,
    ...site.links.map((link) => `- [${link.label}](${link.href})`),
    `- Email: ${site.email}`,
    "",
  );

  return new Response(parts.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
