import { signedIn } from "@/lib/auth";
import { store } from "@/lib/uploads";

/** Where an image arrives. Behind the same session as the rest of the editor,
 *  and under /admin, which robots.ts disallows and the sitemap never mentions.
 *
 *  The reply is the stored name. The editor writes it into the body as
 *  `![caption](name)` and never thinks about the file again. */
export const dynamic = "force-dynamic";

const whole = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 30000 ? n : 0;
};

export async function POST(request: Request) {
  if (!(await signedIn())) return new Response("Not signed in", { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("No file", { status: 400 });

  /* Measured by the browser that had the image open anyway. It decides how much
     room the page reserves and nothing else, so it costs nothing to be wrong. */
  const width = whole(form.get("width"));
  const height = whole(form.get("height"));

  const name = await store(file, width && height ? { width, height } : null);
  if (!name) return new Response("Not an image this site keeps", { status: 415 });

  return Response.json({ name });
}
