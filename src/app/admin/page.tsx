import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getBio } from "@/lib/editor";
import { sectionList } from "@/lib/labels";
import Bio from "./bio";

export const dynamic = "force-dynamic";

/** The way in, and the home page seen from the other side: the bio where the
 *  home page prints it, and under it the three lists it links to. A count of
 *  what is in them is one click away, and is the list. */
export default async function Dashboard() {
  await requireSession();
  const bio = await getBio();

  return (
    <>
      <h1 className="vh">Editor</h1>

      <Bio initial={bio} />

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
