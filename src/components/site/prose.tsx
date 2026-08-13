import type { Block } from "@/lib/blocks";
import { inline } from "@/lib/inline";

/** The one renderer for a writing's body. The public page and the editor's
 *  preview both mount this component, so the preview cannot drift from the
 *  page: there is only one implementation to drift from. */
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
