import { contentType } from "@/lib/media";
import { read } from "@/lib/uploads";

/** Uploaded images, served off disk.
 *
 *  A name is only ever handed out once, so the file behind it never changes and
 *  the answer can be cached forever. Read per request: the directory is a volume
 *  in production and its contents outlive the build that serves them. */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const file = await read(name);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": contentType(name),
      "content-length": String(file.byteLength),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
