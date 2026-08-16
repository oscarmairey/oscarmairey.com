import { site } from "@/content/site";

/** Written by hand rather than generated, so it can say something.
 *
 *  Nothing that reads is turned away here. The assistants are named one by one
 *  because a name absent from a block list is easy to miss and easy to doubt,
 *  and because the point is to be quoted correctly rather than to be crawled
 *  politely. The editor is the only thing closed, and it is noindex besides. */
export const dynamic = "force-dynamic";

/** Named readers, in no particular order: OpenAI, Anthropic, Perplexity,
 *  Google's AI reader, Common Crawl, Apple, Amazon, Meta, ByteDance, Mistral. */
const READERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
  "Amazonbot",
  "meta-externalagent",
  "Bytespider",
  "MistralAI-User",
];

export async function GET() {
  const lines = [
    "# Every reader is welcome, including the ones that are not people.",
    `# A map for them: ${site.url}/llms.txt`,
    `# All of it at once: ${site.url}/llms-full.txt`,
    "# One entry as markdown: /md/<list>/<slug>",
    "",
    "User-Agent: *",
    "Allow: /",
    "Disallow: /admin",
    "",
    "# Said again for the ones that are asked about by name.",
    ...READERS.flatMap((agent) => [`User-Agent: ${agent}`, "Allow: /", "Disallow: /admin", ""]),
    `Sitemap: ${site.url}/sitemap.xml`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
