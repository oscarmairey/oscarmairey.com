import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { counts } from "@/lib/editor";
import { sectionList } from "@/lib/labels";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

/** The way in, and the only place the three lists are named: a count, a link,
 *  and the way out. */
export default async function Dashboard() {
  await requireSession();
  const rows = await counts();

  return (
    <>
      <h1 className="vh">Editor</h1>

      <section className="section">
        <ul className="rows">
          {sectionList.map((spec) => {
            const row = rows.find((r) => r.label === spec.label);
            const total = row?.total ?? 0;
            const live = row?.live ?? 0;

            return (
              <li key={spec.section}>
                <p className="line">
                  <Link className="t" href={`/admin/${spec.section}`}>
                    {spec.plural}
                  </Link>
                  <span className="when">
                    {spec.draftable ? `${live} published, ${total - live} in draft` : `${total}`}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>

        <form action={signOut}>
          <button className="more" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </>
  );
}
