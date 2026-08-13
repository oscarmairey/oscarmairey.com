import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listCompanies } from "@/lib/editor";

export const metadata: Metadata = { title: "Companies" };
export const dynamic = "force-dynamic";

/** The record, in the order the site prints it. The first row is what /building
 *  reads under "Currently", which is why the order matters enough to show. */
export default async function CompaniesAdmin() {
  await requireSession();
  const companies = await listCompanies();

  return (
    <>
      <h1 className="adm-title">Companies</h1>
      <p className="adm-hint">
        In the order the site shows them. The first is the one /building reads as Currently.
      </p>

      <section className="adm-section">
        <ul className="adm-list">
          {companies.map((c) => (
            <li key={c.id}>
              <p className="adm-row">
                <Link className="adm-name" href={`/admin/companies/${c.id}`}>
                  {c.name || "Untitled"}
                </Link>
                <span className="adm-state">{c.period || `#${c.sortOrder}`}</span>
              </p>
              {c.summary && <p className="adm-sub">{c.summary}</p>}
            </li>
          ))}
        </ul>
        {companies.length === 0 && <p className="adm-empty">Nothing in the record yet.</p>}

        <div className="adm-buttons" style={{ marginTop: "1.6rem" }}>
          <Link className="adm-btn primary" href="/admin/companies/new">
            New company
          </Link>
        </div>
      </section>
    </>
  );
}
