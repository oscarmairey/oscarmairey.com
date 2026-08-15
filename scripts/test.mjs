#!/usr/bin/env node
/** Runs the browser suite against a site of its own.
 *
 *  The suite drives the real editor: it writes, publishes, unpublishes and
 *  deletes. Pointed at the site Oscar uses, one mistargeted click is a piece of
 *  his writing gone — so it is never pointed there. This starts a server that
 *  exists for the length of the run:
 *
 *    its own database   oscarmairey_test, emptied and migrated before each run
 *    its own build      .next-test, so the dev server on 3101 is untouched
 *    its own uploads    .test/uploads, wiped with it
 *    its own password   made up here, unrelated to the real one
 *    its own port       3102 by default, on the loopback, no proxy in front
 *
 *  Everything the suite needs is seeded by the migrations, so it starts from
 *  the same content every time and has nothing to clean up afterwards.
 *
 *    npm test
 */

import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.TEST_PORT ?? 3102);
const DIST = ".next-test";
const UPLOADS = join(root, ".test/uploads");

/** The password the suite signs in with. Made here, known only to this run. */
const PASSWORD = "test-only-" + randomBytes(6).toString("hex");

const hash = (password) => {
  const salt = randomBytes(16);
  const params = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const key = scryptSync(password.normalize("NFKC"), salt, 32, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join(":");
};

/** Whatever DATABASE_URL is lying around, the test database is named here and
 *  checked before anything is dropped. */
function testUrl() {
  const live = process.env.DATABASE_URL ?? readEnv("DATABASE_URL") ?? "";
  const url = process.env.TEST_DATABASE_URL ?? live.replace(/\/oscarmairey(\?|$)/, "/oscarmairey_test$1");

  if (!/\/oscarmairey_test(\?|$)/.test(url)) {
    throw new Error(
      `refusing to run: ${url ? "that is not the test database" : "no DATABASE_URL to derive one from"}.\n` +
        "  The suite writes and deletes. It runs against oscarmairey_test and nothing else.\n" +
        "  Create it once:  docker exec xtrapoll-db-1 psql -U xtrapoll -d postgres -c 'CREATE DATABASE oscarmairey_test OWNER oscarmairey'",
    );
  }
  return url;
}

function readEnv(name) {
  for (const file of [".env.local", ".env"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (m && m[1] === name) return m[2].trim().replace(/^(['"])(.*)\1$/s, "$2");
    }
  }
  return undefined;
}

async function freshDatabase(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    /* Emptied rather than tidied: a run starts from the migrations and nothing
       a previous run did can survive to confuse this one. */
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end();
  }

  await run("node", [join(root, "scripts/migrate.mjs")], { DATABASE_URL: url }, true);
}

const run = (command, args, env, quiet) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });

async function waiting(base) {
  for (let i = 0; i < 240; i++) {
    try {
      const answer = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (answer.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("the test server never answered");
}

const url = testUrl();
const base = `http://127.0.0.1:${PORT}`;

/* A server already on the port is somebody else's, and starting behind it would
   run the suite against whatever that is. */
try {
  await fetch(base, { signal: AbortSignal.timeout(1500) });
  console.error(
    `refusing to run: something is already answering on ${base}.\n` +
      "  Stop it, or give this run a port of its own with TEST_PORT.",
  );
  process.exit(2);
} catch {
  /* nothing there, which is what we want */
}

console.log(`  database ${url.replace(/:\/\/[^@]+@/, "://…@")}`);
console.log(`  server   ${base}\n`);

rmSync(join(root, ".test"), { recursive: true, force: true });
await freshDatabase(url);

const server = spawn("npx", ["next", "dev", "-p", String(PORT), "--hostname", "127.0.0.1"], {
  cwd: root,
  /* Its own process group: next runs the server as a child of a child, and
     signalling only the one we spawned leaves the server holding the port. */
  detached: true,
  env: {
    ...process.env,
    NODE_ENV: "development",
    NEXT_DIST_DIR: DIST,
    DATABASE_URL: url,
    UPLOADS_DIR: UPLOADS,
    ADMIN_PASSWORD_HASH: hash(PASSWORD),
    SESSION_SECRET: randomBytes(32).toString("base64url"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

/* Kept quiet unless something goes wrong, and then it is the only thing worth
   reading. */
let said = "";
const listen = (stream) => stream.on("data", (chunk) => (said += chunk.toString()));
listen(server.stdout);
listen(server.stderr);

let stopped = false;
const stop = () => {
  if (stopped || !server.pid) return;
  stopped = true;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
};
process.on("exit", stop);
process.on("SIGINT", () => (stop(), process.exit(130)));

let failed = false;
try {
  await waiting(base);
  await run("node", [join(root, "tests/editor.test.mjs")], { TEST_BASE: base, TEST_PASSWORD: PASSWORD });
} catch (error) {
  console.error(`\n${error.message}`);
  if (said.trim()) console.error(`\n  what the server said:\n${said.split("\n").map((l) => "  " + l).join("\n")}`);
  failed = true;
} finally {
  stop();
  rmSync(join(root, ".test"), { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
