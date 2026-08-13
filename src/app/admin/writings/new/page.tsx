import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import Editor from "../editor";

export const metadata: Metadata = { title: "New writing" };
export const dynamic = "force-dynamic";

/** No row is created until the first save, so opening this page and walking
 *  away leaves nothing behind. */
export default async function NewWriting() {
  await requireSession();

  return (
    <Editor
      initial={{
        id: null,
        title: "",
        subtitle: "",
        slug: "",
        body: "",
        readingTime: "",
        date: "",
        published: false,
      }}
    />
  );
}
