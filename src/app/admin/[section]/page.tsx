import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/editor";
import { isSection, sections } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { section } = await params;
  return { title: isSection(section) ? sections[section].plural : "Editor" };
}

/** The same list the site prints, in the same classes, with the drafts in it —
 *  which every label now has — and every title leading to the editor instead of
 *  the page. */
export default async function SectionList({ params }: Params) {
  await requireSession();

  const { section } = await params;
  if (!isSection(section)) notFound();

  const spec = sections[section];
  const rows = await listItems(spec.label);

  return (
    <>
      <h1 className="vh">{spec.plural}</h1>

      <section className="section">
        <ul className="rows">
          {rows.map((row) => (
            <li key={row.id}>
              <p className="line">
                <Link className="t" href={`/admin/${section}/${row.slug}`}>
                  {row.title || "Untitled"}
                </Link>
                <span className="when">{row.published ? spec.meta(row).text : "Draft"}</span>
              </p>
              {row.subtitle && <p className="note">{row.subtitle}</p>}
            </li>
          ))}
        </ul>

        <div className="adm-buttons">
          <Link className="adm-btn primary" href={`/admin/${section}/new`}>
            New {spec.one}
          </Link>
          <Link className="more" href="/admin">
            Return
          </Link>
        </div>
      </section>
    </>
  );
}
