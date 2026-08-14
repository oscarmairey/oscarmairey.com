import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { counts } from "@/lib/editor";
import { sectionList } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** The way in. Everything is edited through the same three lists, so this page
 *  is a count and a door, and nothing else. */
export default async function Dashboard() {
  await requireSession();
  const rows = await counts();

  return (
    <>
      <h1 className="adm-title">Editor</h1>
      <p className="adm-hint">Notes, books and companies are one table with three labels.</p>

      {sectionList.map((spec) => {
        const row = rows.find((r) => r.label === spec.label);
        const total = row?.total ?? 0;
        const live = row?.live ?? 0;

        return (
          <section className="adm-section" key={spec.section}>
            <h2>{spec.plural}</h2>
            <p className="adm-hint">
              {spec.draftable
                ? `${live} published, ${total - live} in draft.`
                : `${total} on the site.`}
            </p>
            <div className="adm-buttons" style={{ marginTop: "1.6rem" }}>
              <Link className="adm-btn" href={`/admin/${spec.section}`}>
                Edit {spec.plural.toLowerCase()}
              </Link>
              <Link className="adm-btn primary" href={`/admin/${spec.section}/new`}>
                New {spec.one}
              </Link>
            </div>
          </section>
        );
      })}

      <p className="adm-foot">
        Everything the site lists lives in Postgres. What is left in <code>src/content</code> — the
        bio, the links — still changes with a deploy.
      </p>
    </>
  );
}
