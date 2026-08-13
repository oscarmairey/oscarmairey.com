#!/usr/bin/env node
/** Migrations, kept deliberately small: every .sql file in migrations/ is applied
 *  once, in filename order, each inside its own transaction, and recorded in
 *  schema_migrations. No ORM, no generated files, nothing to learn.
 *
 *    npm run db:migrate            apply what is pending
 *    npm run db:migrate -- --status  list without applying
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Next loads .env files itself; a plain node script has to do it by hand. */
function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!match) continue;
      const value = match[2].trim().replace(/^(['"])(.*)\1$/s, "$2");
      if (!(match[1] in process.env)) process.env[match[1]] = value;
    }
  }
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (looked in the environment, .env.local, .env)");
    process.exit(1);
  }

  const dir = join(root, "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.filename));

    if (process.argv.includes("--status")) {
      for (const file of files) console.log(`${applied.has(file) ? "applied" : "pending"}  ${file}`);
      return;
    }

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log("nothing to apply");
      return;
    }

    for (const file of pending) {
      const sql = await readFile(join(dir, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`applied  ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`failed   ${file}\n${error.message}`);
        process.exitCode = 1;
        return;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
