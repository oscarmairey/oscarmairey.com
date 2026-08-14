import type { Metadata } from "next";
import Entries from "@/components/site/entries";
import { published } from "@/lib/content";
import { alternatesFor } from "@/lib/meta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Companies",
  description: "The record: what I'm building now, and everything before it.",
  alternates: alternatesFor("/companies"),
};

/** The record, in the order Oscar set, which puts the current company first.
 *  Everything about a company is on its own page. */
export default async function CompaniesPage() {
  const companies = await published("companies");

  return (
    <>
      <h1 className="vh">Companies</h1>
      <section className="section">
        <Entries section="companies" items={companies} />
      </section>
    </>
  );
}
