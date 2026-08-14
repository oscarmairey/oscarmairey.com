import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Entry from "@/components/site/entry";
import { published, publishedOne } from "@/lib/content";
import { entryMetadata } from "@/lib/meta";

type Params = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return entryMetadata("companies", await publishedOne("companies", slug));
}

export default async function CompanyPage({ params }: Params) {
  const { slug } = await params;
  const company = await publishedOne("companies", slug);
  if (!company) notFound();

  const all = await published("companies");
  return <Entry section="companies" item={company} list={all} />;
}
