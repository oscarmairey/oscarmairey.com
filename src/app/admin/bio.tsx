"use client";

import { useEffect, useRef, useState } from "react";
import { Region } from "./editable";
import { saveBio } from "./actions";

/** The one line on the home page that is not an entry, edited where it is read:
 *  in the same `.lede` the home page prints it in, in the same type, saving
 *  itself three seconds after the typing stops like everything else. */

const AUTOSAVE_MS = 3000;

export default function Bio({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const savedRef = useRef(initial);
  const textRef = useRef(text);
  textRef.current = text;

  const dirty = text !== savedRef.current;

  async function persist() {
    const sending = textRef.current;
    setBusy(true);
    setError("");
    try {
      const result = await saveBio(sending);
      if (!result.ok) return setError(result.error);
      savedRef.current = sending;
      setSavedAt(new Date());
    } catch {
      setError("The save did not go through. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const persistRef = useRef(persist);
  persistRef.current = persist;

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void persistRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [text, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const status = !ready
    ? "Loading the editor…"
    : error
      ? error
      : busy
        ? "Saving…"
        : dirty
          ? "Unsaved"
          : savedAt
            ? `Saved at ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
            : "On the site";

  return (
    <>
      <div className="lede">
        <p>
          <Region
            as="span"
            region="bio"
            source={initial}
            placeholder="Two sentences, in the first person."
            onChange={setText}
          />
        </p>
      </div>
      <p className={error ? "adm-status bad" : "adm-status"} role="status">
        {status}
      </p>
    </>
  );
}
