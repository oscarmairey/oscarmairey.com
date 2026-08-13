import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Prose from "@/components/site/prose";
import { site } from "@/content/site";
import { parseBody } from "@/lib/blocks";
import { publishedWriting, publishedWritings } from "@/lib/content";
import { formatDay, formatMonth } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const writing = await publishedWriting(slug);
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
  const writing = await publishedWriting(slug);
  if (!writing) notFound();

  const all = await publishedWritings();
  const others = all.filter((w) => w.slug !== writing.slug).slice(0, 2);

  return (
    <>
      <article>
        <h1 className="title">{writing.title}</h1>
        {writing.subtitle && <p className="sub">{writing.subtitle}</p>}
        <p className="stamp">
          <time dateTime={writing.date}>{formatDay(writing.date)}</time>
          {writing.readingTime && ` · ${writing.readingTime}`}
        </p>

        <Prose blocks={parseBody(writing.body)} />
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
