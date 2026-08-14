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

/** One list for the three labels: everything under it, in the order the site
 *  prints it, with whatever metadata that label carries on the right. */
export default async function SectionList({ params }: Params) {
  await requireSession();

  const { section } = await params;
  if (!isSection(section)) notFound();

  const spec = sections[section];
  const rows = await listItems(spec.label);

  return (
    <>
      <h1 className="adm-title">{spec.plural}</h1>
      <p className="adm-hint">
        {spec.ordered
          ? "In the order the site shows them. Lower numbers come first."
          : "Newest first. A draft is invisible to everyone but you."}
      </p>

      <section className="adm-section">
        <ul className="adm-list">
          {rows.map((row) => {
            const draft = spec.draftable && !row.published;
            return (
              <li key={row.id}>
                <p className="adm-row">
                  <Link className="adm-name" href={`/admin/${section}/${row.id}`}>
                    {row.title || "Untitled"}
                  </Link>
                  <span className={draft ? "adm-state" : "adm-state live"}>
                    {draft ? "Draft" : spec.meta(row).text || `#${row.sortOrder}`}
                  </span>
                </p>
                {row.subtitle && <p className="adm-sub">{row.subtitle}</p>}
              </li>
            );
          })}
        </ul>
        {rows.length === 0 && <p className="adm-empty">Nothing here yet.</p>}

        <div className="adm-buttons" style={{ marginTop: "1.6rem" }}>
          <Link className="adm-btn primary" href={`/admin/${section}/new`}>
            New {spec.one}
          </Link>
        </div>
      </section>
    </>
  );
}
