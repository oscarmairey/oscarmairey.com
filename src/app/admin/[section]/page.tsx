import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/editor";
import { isSection, sections } from "@/lib/labels";
import Rows from "./rows";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { section } = await params;
  return { title: isSection(section) ? sections[section].plural : "Editor" };
}

/** The same list the site prints, in the same classes, with the drafts in it —
 *  which every label now has — and every title leading to the editor instead of
 *  the page. Each row has a grip: the order here is the order the site reads,
 *  drafts included, so dragging one moves it for everybody. */
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
        <Rows
          section={section}
          initial={rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            subtitle: row.subtitle,
            when: row.published ? spec.meta(row).text : "Draft",
          }))}
        />

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
