import type { Metadata } from "next";
import { companies, currently, code, talks } from "@/content/building";
import { inline } from "@/lib/inline";

export const metadata: Metadata = {
  title: "Building",
  description: "What I'm working on now, then everything before it.",
  alternates: { canonical: "/building" },
};

export default function BuildingPage() {
  return (
    <>
      <h1 className="title">Building</h1>

      <section className="section">
        <h2>Currently</h2>
        <p className="hook">{currently.date}</p>
        <div className="prose">
          {currently.blocks.map((text, i) => (
            <p key={i}>{inline(text)}</p>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Previously</h2>
        <ul className="rows record">
          {companies.map((c) => (
            <li key={c.name}>
              <p className="line">
                <span className="t">{c.name}</span>
                <span className="when">{c.years}</span>
              </p>
              {c.role && <p className="role">{c.role}</p>}
              <p className="rec">{c.description}</p>
              {c.result && <p className="rec">{inline(c.result)}</p>}
            </li>
          ))}
        </ul>
      </section>

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
