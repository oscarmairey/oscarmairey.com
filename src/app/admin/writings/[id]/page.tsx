import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getWriting } from "@/lib/editor";
import Editor from "../editor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireSession();
  const { id } = await params;
  const row = await getWriting(Number(id));
  return { title: row?.title || "Writing" };
}

export default async function EditWriting({ params }: Params) {
  await requireSession();

  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) notFound();

  const row = await getWriting(numeric);
  if (!row) notFound();

  return (
    <Editor
      initial={{
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        slug: row.slug,
        body: row.body,
        readingTime: row.readingTime,
        date: row.date,
        published: row.published,
      }}
    />
  );
}
