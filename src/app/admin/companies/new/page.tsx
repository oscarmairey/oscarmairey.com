import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { nextCompanyOrder } from "@/lib/editor";
import CompanyEditor from "../editor";

export const metadata: Metadata = { title: "New company" };
export const dynamic = "force-dynamic";

/** No row is created until the first save, so opening this page and walking
 *  away leaves nothing behind. The order is read now so the new company lands
 *  at the end of the record rather than at the top of it. */
export default async function NewCompany() {
  await requireSession();
  const sortOrder = await nextCompanyOrder();

  return (
    <CompanyEditor
      initial={{
        id: null,
        slug: "",
        name: "",
        role: "",
        period: "",
        summary: "",
        body: "",
        url: "",
        sortOrder,
      }}
    />
  );
}
