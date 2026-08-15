"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { reorderItems } from "../actions";

/** The list, in the order Oscar drags it into.
 *
 *  Pointer events rather than the browser's drag and drop: that one is a mouse
 *  API wearing a touch costume, and this has to work under a thumb. The grip
 *  takes the pointer, the row follows it, and the list rearranges itself as it
 *  passes — so where it will land is simply where it is.
 *
 *  Dropping saves the whole order in one statement. Arrow keys move a row too,
 *  for the times a pointer is the wrong tool. */

export type View = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  when: string;
};

export default function Rows({ section, initial }: { section: string; initial: View[] }) {
  const [rows, setRows] = useState(initial);
  const [held, setHeld] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const items = useRef<(HTMLLIElement | null)[]>([]);
  const saved = useRef(initial.map((row) => row.id).join());
  const busy = useRef(false);

  async function keep(order: View[]) {
    const ids = order.map((row) => row.id);
    if (ids.join() === saved.current || busy.current) return;

    busy.current = true;
    setStatus("Saving…");
    try {
      const result = await reorderItems(section, ids);
      if (!result.ok) return setStatus(result.error);
      saved.current = ids.join();
      setStatus(
        `Saved at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
      );
    } catch {
      setStatus("The order did not save. Check the connection and try again.");
    } finally {
      busy.current = false;
    }
  }

  const moved = (from: number, to: number) => {
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    return next;
  };

  function take(index: number, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHeld(index);
  }

  function drag(event: React.PointerEvent<HTMLButtonElement>) {
    if (held === null) return;

    /* The row the pointer is over, by its own box: rows are different heights,
       and the one under the finger is the one that matters. */
    const over = items.current.findIndex((el) => {
      if (!el) return false;
      const box = el.getBoundingClientRect();
      return event.clientY >= box.top && event.clientY <= box.bottom;
    });

    if (over === -1 || over === held) return;
    setRows(moved(held, over));
    setHeld(over);
  }

  function drop(event: React.PointerEvent<HTMLButtonElement>) {
    if (held === null) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setHeld(null);
    void keep(rows);
  }

  function nudge(index: number, event: React.KeyboardEvent<HTMLButtonElement>) {
    const to = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1;
    if (to < 0 || to >= rows.length) return;

    event.preventDefault();
    const next = moved(index, to);
    setRows(next);
    void keep(next);

    /* The grip keeps the focus, so the row can be walked up the list. */
    requestAnimationFrame(() => items.current[to]?.querySelector("button")?.focus());
  }

  return (
    <>
      <ul className="rows">
        {rows.map((row, i) => (
          <li
            key={row.id}
            className={held === i ? "adm-held" : undefined}
            ref={(el) => {
              items.current[i] = el;
            }}
          >
            <button
              className="adm-grip"
              type="button"
              aria-label={`Move ${row.title || "Untitled"}`}
              onPointerDown={(event) => take(i, event)}
              onPointerMove={drag}
              onPointerUp={drop}
              onPointerCancel={drop}
              onKeyDown={(event) => nudge(i, event)}
            />
            <div className="adm-rowbody">
              <p className="line">
                <Link className="t" href={`/admin/${section}/${row.slug}`}>
                  {row.title || "Untitled"}
                </Link>
                <span className="when">{row.when}</span>
              </p>
              {row.subtitle && <p className="note">{row.subtitle}</p>}
            </div>
          </li>
        ))}
      </ul>

      {status && (
        <p className="adm-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}
