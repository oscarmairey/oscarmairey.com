import type { Metadata } from "next";
import Entries from "@/components/site/entries";
import { published } from "@/lib/content";
import { alternatesFor } from "@/lib/meta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notes",
  description: "Notes on markets and the software underneath them.",
  alternates: alternatesFor("/notes"),
};

export default async function NotesPage() {
  const notes = await published("notes");

  return (
    <>
      <h1 className="vh">Notes</h1>
      <section className="section">
        <Entries section="notes" items={notes} />
      </section>
    </>
  );
}
