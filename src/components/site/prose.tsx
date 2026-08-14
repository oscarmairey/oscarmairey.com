import type { Block } from "@/lib/blocks";
import { inline } from "@/lib/inline";
import { imageSize, mediaUrl } from "@/lib/media";

/** The one renderer for a body. The public page mounts it; the editor draws
 *  the same blocks itself, editable, in the same classes. */
export default function Prose({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h2":
            return <h2 key={i}>{block.text}</h2>;

          case "quote":
            return (
              <blockquote key={i}>
                <p>{inline(block.text)}</p>
                {block.source && <p className="src">{inline(block.source)}</p>}
              </blockquote>
            );

          /* A plain <img>: the file was stored as it arrived, and the size it
             was measured at is in its name, so there is nothing to optimise at
             request time and no loader to configure. */
          case "image":
            return (
              <figure key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(block.src)}
                  alt={block.text}
                  loading="lazy"
                  decoding="async"
                  {...imageSize(block.src)}
                />
                {block.text && <figcaption>{inline(block.text)}</figcaption>}
              </figure>
            );

          /* Notes render inside the paragraph they follow, so the float starts
             on the line carrying the marker rather than below it. */
          case "note":
            return null;

          default: {
            const next = blocks[i + 1];
            const note = next?.kind === "note" ? next : undefined;
            return (
              <p key={i}>
                {inline(block.text)}
                {note && (
                  <span className="sn" id={`note-${note.n}`}>
                    <span className="n">{note.n}</span>
                    {inline(note.text)}
                  </span>
                )}
              </p>
            );
          }
        }
      })}
    </div>
  );
}
