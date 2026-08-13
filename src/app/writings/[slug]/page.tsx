import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Block } from "@/content/writings";
import { published, getWriting, formatDay, formatMonth } from "@/content/writings";
import { inline } from "@/lib/inline";
import { site } from "@/content/site";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return published.map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const writing = getWriting(slug);
  if (!writing) return {};
  return {
    title: writing.title,
    description: writing.subtitle,
    alternates: { canonical: `/writings/${writing.slug}` },
    openGraph: {
      type: "article",
      title: writing.title,
      description: writing.subtitle,
      publishedTime: writing.date,
      url: `${site.url}/writings/${writing.slug}`,
    },
    twitter: { card: "summary_large_image", title: writing.title, description: writing.subtitle },
  };
}

export default async function WritingPage({ params }: Params) {
  const { slug } = await params;
  const writing = getWriting(slug);
  if (!writing || !writing.blocks) notFound();

  const others = published.filter((w) => w.slug !== writing.slug).slice(0, 2);

  return (
    <>
      <article>
        <h1 className="title">{writing.title}</h1>
        <p className="sub">{writing.subtitle}</p>
        <p className="stamp">
          <time dateTime={writing.date}>{formatDay(writing.date)}</time>
          {writing.readingTime && ` · ${writing.readingTime}`}
        </p>

        <div className="prose">
          {writing.blocks.map((block, i) => {
            switch (block.kind) {
              case "h2":
                return <h2 key={i}>{block.text}</h2>;
              case "quote":
                return (
                  <blockquote key={i}>
                    <p>{block.text}</p>
                    <p className="src">{block.source}</p>
                  </blockquote>
                );
              /* Notes render inside the paragraph they follow, so the float
                 starts on the line carrying the marker rather than below it. */
              case "note":
                return null;
              default: {
                const note =
                  writing.blocks?.[i + 1]?.kind === "note"
                    ? (writing.blocks[i + 1] as Extract<Block, { kind: "note" }>)
                    : undefined;
                return (
                  <p key={i}>
                    {inline(block.text)}
                    {note && (
                      <span className="sn" id={`note-${note.n}`}>
                        <span className="n">{note.n}</span>
                        {inline(note.text)}
                      </span>
                    )}
                  </p>
                );
              }
            }
          })}
        </div>
      </article>

      {others.length > 0 && (
        <section className="section">
          <h2>Nearby</h2>
          <ul className="rows tight">
            {others.map((w) => (
              <li key={w.slug}>
                <p className="line">
                  <Link className="t" href={`/writings/${w.slug}`}>
                    {w.title}
                  </Link>
                  <time className="when" dateTime={w.date}>
                    {formatMonth(w.date)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
          <Link className="more" href="/writings">
            All writings
          </Link>
        </section>
      )}
    </>
  );
}
