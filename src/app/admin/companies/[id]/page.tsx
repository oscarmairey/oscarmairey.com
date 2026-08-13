import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getCompany } from "@/lib/editor";
import CompanyEditor from "../editor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireSession();
  const { id } = await params;
  const row = await getCompany(Number(id));
  return { title: row?.name || "Company" };
}

export default async function EditCompany({ params }: Params) {
  await requireSession();

  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) notFound();

  const row = await getCompany(numeric);
  if (!row) notFound();

  return <CompanyEditor initial={{ ...row }} />;
}
