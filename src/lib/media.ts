/** What an uploaded image is, everywhere: in the editor that pastes it, in the
 *  page that prints it, and in the two routes that store and serve it.
 *
 *  Pure on purpose — the client imports it too. Nothing here touches the disk;
 *  src/lib/uploads.ts does that. */

/** What the editor accepts and what the server keeps. The value is the
 *  extension a stored file gets, so the name always tells the truth about the
 *  bytes, whatever the browser called the file. */
export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const ACCEPT = Object.keys(IMAGE_TYPES).join(",");

/** Stored as received: no resizing, no re-encoding, nothing that would need a
 *  library. So the cap is what a photograph off a phone weighs. */
export const MAX_BYTES = 8 * 1024 * 1024;

/** A stored name, which is the only shape either route will answer to. Slugged
 *  stem, random tag, the size the browser measured, one extension: no dots, no
 *  slashes, no way to name anything but a file in the uploads directory. */
export const NAME = /^[a-z0-9][a-z0-9-]*\.(png|jpg|webp|gif|avif)$/;

const CONTENT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export const contentType = (name: string) =>
  CONTENT[name.slice(name.lastIndexOf(".") + 1)] ?? "application/octet-stream";

export const mediaUrl = (name: string) => `/media/${encodeURIComponent(name)}`;

/** The size the browser measured at upload, read back out of the name.
 *
 *  It is there so a page can reserve the right box before the bytes arrive and
 *  nothing jumps as they do. Keeping it in the name rather than in a column
 *  means no schema for it, no parser for it, and no way for it to drift from
 *  the file it describes. */
export function imageSize(name: string): { width: number; height: number } | undefined {
  const match = name.match(/-(\d+)x(\d+)\.[a-z]+$/);
  if (!match) return undefined;
  return { width: Number(match[1]), height: Number(match[2]) };
}
