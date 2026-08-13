import type { Metadata } from "next";
import Link from "next/link";
import Prose from "@/components/site/prose";
import { code, talks } from "@/content/building";
import { parseBody } from "@/lib/blocks";
import { publicCompanies } from "@/lib/content";
import { inline } from "@/lib/inline";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Building",
  description: "What I'm working on now, then everything before it.",
  alternates: { canonical: "/building" },
};

/** The first company in the record is the current one, so it reads here in full
 *  the way "Currently" always did. The rest are a list, and every name — the
 *  current one included — leads to its own page. */
export default async function BuildingPage() {
  const companies = await publicCompanies();
  const [now, ...previously] = companies;

  return (
    <>
      <h1 className="title">Building</h1>

      {now && (
        <section className="section">
          <div className="section-head">
            <h2>Currently</h2>
            <Link className="more" href={`/building/${now.slug}`}>
              {now.name}
            </Link>
          </div>
          {now.body ? (
            <Prose blocks={parseBody(now.body)} />
          ) : (
            <div className="prose">
              <p>{inline(now.summary)}</p>
            </div>
          )}
        </section>
      )}

      {previously.length > 0 && (
        <section className="section">
          <h2>Previously</h2>
          <ul className="rows record">
            {previously.map((c) => (
              <li key={c.slug}>
                <p className="line">
                  <Link className="t" href={`/building/${c.slug}`}>
                    {c.name}
                  </Link>
                  {c.period && <span className="when">{c.period}</span>}
                </p>
                {c.role && <p className="role">{c.role}</p>}
                <p className="rec">{inline(c.summary)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2>Code</h2>
        <div className="prose">
          <p>{inline(code)}</p>
        </div>
      </section>

      <section className="section" id="talks">
        <h2>Talks</h2>
        <ul className="rows">
          {talks.map((t) => (
            <li key={t.href}>
              <p className="line">
                <span className="t">{t.title}</span>
                <span className="when">{t.meta}</span>
              </p>
              <p className="note">
                {t.note}{" "}
                <a href={t.href} rel="noopener noreferrer">
                  Video
                </a>{" "}
                (French)
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
