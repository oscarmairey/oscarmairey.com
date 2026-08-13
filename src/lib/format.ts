/** Dates are stored as timestamps and displayed as English long dates, in UTC,
 *  so the string is the same wherever it is rendered. */

export function formatMonth(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDay(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
