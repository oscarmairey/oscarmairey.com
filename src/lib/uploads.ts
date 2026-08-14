import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { slugify } from "@/lib/blocks";
import { IMAGE_TYPES, MAX_BYTES, NAME } from "@/lib/media";

/** Where uploaded images live, and the only code that touches that directory.
 *
 *  Not `public/`: that is copied into the image at build time, so anything
 *  written there in production is thrown away by the next deploy. The uploads
 *  directory sits outside the build and is a Docker volume in production —
 *  UPLOADS_DIR names it, and in development it is ./uploads beside the repo. */

const directory = () => process.env.UPLOADS_DIR || join(process.cwd(), "uploads");

/** The path a stored name maps to, or nothing.
 *
 *  The name has to match the shape this module writes, and the path it resolves
 *  to has to still be inside the directory. Either check alone would do; both
 *  cost nothing. */
function pathFor(name: string): string | null {
  if (!NAME.test(name)) return null;
  const base = resolve(directory());
  const path = resolve(base, name);
  return path.startsWith(base + sep) ? path : null;
}

export async function read(name: string): Promise<Buffer | null> {
  const path = pathFor(name);
  if (!path) return null;
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

/** Keeps a file as it arrived and answers with the name it now has.
 *
 *  The name carries the original stem so the body text stays readable, a random
 *  tag so nothing ever collides or overwrites, the size the browser measured so
 *  a page can reserve the box, and the extension the content type earned rather
 *  than the one the file claimed. */
export async function store(
  file: File,
  size: { width: number; height: number } | null,
): Promise<string | null> {
  const extension = IMAGE_TYPES[file.type];
  if (!extension || file.size === 0 || file.size > MAX_BYTES) return null;

  const stem =
    slugify(file.name.replace(/\.[^.]*$/, ""))
      .slice(0, 40)
      .replace(/-+$/, "") || "image";
  const tag = randomBytes(5).toString("hex");
  const measured = size ? `-${size.width}x${size.height}` : "";
  const name = `${stem}-${tag}${measured}.${extension}`;

  const path = pathFor(name);
  if (!path) return null;

  await mkdir(directory(), { recursive: true });
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  return name;
}

/** Best effort: a file that will not go away is not worth a failed save. */
export async function forget(name: string): Promise<void> {
  const path = pathFor(name);
  if (!path) return;
  await unlink(path).catch(() => {});
}
