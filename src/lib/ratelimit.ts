/** A counter per client, in memory. One user, one login form: this does not need
 *  Redis, it needs to make a password guessing loop pointless. Restarting the
 *  server clears it, which is an acceptable trade for having no moving parts. */

type Bucket = { count: number; resetAt: number };

const globalForLimit = globalThis as unknown as { __omBuckets?: Map<string, Bucket> };
const buckets = (globalForLimit.__omBuckets ??= new Map());

const WINDOW = 15 * 60 * 1000;
const MAX = 8;

export type Verdict = { ok: true } | { ok: false; retryAfter: number };

export function hit(key: string): Verdict {
  const now = Date.now();

  /* Opportunistic sweep: the map only ever holds a handful of keys. */
  if (buckets.size > 500) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count > MAX) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 60000) };
  }
  return { ok: true };
}

/** A successful login clears the count for that client. */
export function clear(key: string) {
  buckets.delete(key);
}
