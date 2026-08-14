import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { sectionList } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** The way in, and nothing else: three lists, in the order the site prints
 *  them. A count of what is in them is one click away, and is the list. */
export default async function Dashboard() {
  await requireSession();

  return (
    <>
      <h1 className="vh">Editor</h1>

      <section className="section">
        <ul className="rows">
          {sectionList.map((spec) => (
            <li key={spec.section}>
              <p className="line">
                <Link className="t" href={`/admin/${spec.section}`}>
                  {spec.plural}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
