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

/** The cap the server enforces, on the file it actually receives. */
export const MAX_BYTES = 8 * 1024 * 1024;

/** The longest edge a stored image is allowed, and what it is re-encoded at.
 *
 *  1600 covers the 44rem measure on a 2x screen with room to spare; past that a
 *  reader is downloading pixels no page will ever show. */
const LONG_EDGE = 1600;
const QUALITY = 0.85;

/** Already as small as it needs to be, in a format that is already trying. */
const EFFICIENT = new Set(["image/webp", "image/avif"]);

/** What actually gets uploaded, and the size that goes in its name.
 *
 *  The server keeps whatever it is given: there is no processing library on it
 *  and there is not going to be one. But the browser holding the file has a
 *  canvas and an encoder already, so the shrinking happens here, once, before
 *  the bytes ever leave the machine that made them.
 *
 *  The policy, in order:
 *    a GIF is never touched, because a canvas would flatten the animation;
 *    an image already inside the long edge and already webp or avif is kept;
 *    anything else is drawn down to the long edge and re-encoded as webp;
 *    and if that came out no smaller than the original, the original wins.
 *
 *  Browser only. Everything above this line runs on the server too. */
export async function prepare(
  file: File,
): Promise<{ file: File; size: { width: number; height: number } | null }> {
  const keep = async (): Promise<{ file: File; size: { width: number; height: number } | null }> => {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return { file, size };
    } catch {
      return { file, size: null };
    }
  };

  if (file.type === "image/gif") return keep();

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { file, size: null };
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, LONG_EDGE / Math.max(width, height));
  if (scale === 1 && EFFICIENT.has(file.type)) {
    bitmap.close();
    return { file, size: { width, height } };
  }

  const target = { width: Math.round(width * scale), height: Math.round(height * scale) };
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { file, size: { width, height } };
  }

  context.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );

  /* A browser without a webp encoder answers in png, and a small enough image
     can come back bigger than it went in. Either way the original stands. */
  if (!blob || !IMAGE_TYPES[blob.type] || blob.size >= file.size) {
    return { file, size: { width, height } };
  }

  const stem = file.name.replace(/\.[^.]*$/, "") || "image";
  const renamed = new File([blob], `${stem}.${IMAGE_TYPES[blob.type]}`, { type: blob.type });
  return { file: renamed, size: target };
}

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
