import { Pool } from "pg";
import type { PoolClient, QueryResultRow } from "pg";

/** One pool for the process, kept on globalThis so the dev server's hot reload
 *  does not open a new one on every edit.
 *
 *  Every timeout here is short on purpose: the public pages call into this, and
 *  a database that is down must fail fast so the cache in src/lib/content.ts can
 *  answer instead. A request must never hang waiting for Postgres. */

const globalForDb = globalThis as unknown as { __omPool?: Pool };

function pool(): Pool {
  if (!globalForDb.__omPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");

    const p = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
      query_timeout: 5_000,
      statement_timeout: 5_000,
      application_name: "oscarmairey.com",
    });

    /* An idle client dropped by the server emits 'error' on the pool. Without a
       listener that is an unhandled exception and the whole site goes down. */
    p.on("error", () => {});

    globalForDb.__omPool = p;
  }
  return globalForDb.__omPool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/** Several statements, or none of them.
 *
 *  Only the editor uses this, and only where one write touches both tables: an
 *  entry and the version it says something in are two rows, and half of that
 *  pair is not a thing the site should ever hold. Reads stay on the pool, which
 *  is one statement each and needs no client of its own. */
export async function transact<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    /* The rollback is best effort: a connection that has already gone cannot be
       told anything, and the error worth reporting is the first one. */
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
