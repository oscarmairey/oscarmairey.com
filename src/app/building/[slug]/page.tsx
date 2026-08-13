import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Prose from "@/components/site/prose";
import { site } from "@/content/site";
import { parseBody } from "@/lib/blocks";
import { publicCompanies, publicCompany } from "@/lib/content";
import { inline, plain } from "@/lib/inline";

type Params = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

/** One company, read as an essay: the name, then the role and the period as a
 *  stamp, then the long form in the same block format writings use — sidenotes
 *  included, through the same <Prose>. A company with nothing written about it
 *  yet is still a page: it shows the summary rather than an empty column. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const company = await publicCompany(slug);
  if (!company) return {};

  const description = plain(company.summary);
  return {
    title: company.name,
    description,
    alternates: { canonical: `/building/${company.slug}` },
    openGraph: {
      type: "article",
      title: company.name,
      description,
      url: `${site.url}/building/${company.slug}`,
    },
    twitter: { card: "summary_large_image", title: company.name, description },
  };
}

export default async function CompanyPage({ params }: Params) {
  const { slug } = await params;
  const company = await publicCompany(slug);
  if (!company) notFound();

  const all = await publicCompanies();
  const others = all.filter((c) => c.slug !== company.slug);
  const blocks = parseBody(company.body);

  const stamp = [company.period, company.role].filter(Boolean).join(" · ");

  return (
    <>
      <article>
        <h1 className="title">{company.name}</h1>
        {company.summary && <p className="sub">{company.summary}</p>}
        {stamp && <p className="stamp">{stamp}</p>}

        {blocks.length > 0 ? (
          <Prose blocks={blocks} />
        ) : (
          <div className="prose">
            <p>{inline(company.summary)}</p>
          </div>
        )}

        {company.url && (
          <p className="stamp">
            <a href={company.url} rel="noopener noreferrer">
              {company.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </p>
        )}
      </article>

      {others.length > 0 && (
        <section className="section">
          <h2>The rest of the record</h2>
          <ul className="rows tight">
            {others.map((c) => (
              <li key={c.slug}>
                <p className="line">
                  <Link className="t" href={`/building/${c.slug}`}>
                    {c.name}
                  </Link>
                  {c.period && <span className="when">{c.period}</span>}
                </p>
              </li>
            ))}
          </ul>
          <Link className="more" href="/building">
            Full record
          </Link>
        </section>
      )}
    </>
  );
}
