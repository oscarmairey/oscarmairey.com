"use client";

/** The editor is allowed to fail loudly. It is the one part of the site that
 *  cannot work from a cache: showing a stale post about to be overwritten
 *  would be worse than saying the database is unreachable. */
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <h1 className="title">The database did not answer</h1>
      <p className="sub">
        Nothing was lost, and the public site is still up: it serves the last content it read.
        The editor needs Postgres, so try again, and if it keeps failing check that the{" "}
        <code>xtrapoll-db-1</code> container is running.
      </p>
      <div className="adm-buttons">
        <button className="adm-btn primary" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </>
  );
}
