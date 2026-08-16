#!/usr/bin/env node
/** Runs the browser suite against a site of its own.
 *
 *  The suite drives the real editor: it writes, publishes, unpublishes and
 *  deletes. Pointed at the site Oscar uses, one mistargeted click is a piece of
 *  his writing gone — so it is never pointed there. This starts a server that
 *  exists for the length of the run:
 *
 *    its own database   oscarmairey_test, emptied and migrated before each run
 *    its own build      .next-test, kept between runs and rebuilt only when the
 *                       code it was built from has changed
 *    its own uploads    .test/uploads, wiped with it
 *    its own password   made up here, unrelated to the real one
 *    its own port       3102 by default, on the loopback, no proxy in front
 *
 *  And it is a guest on this machine. The box has four cores and runs Oscar's
 *  dev server, the live site, Postgres and his editor; a test suite has no
 *  business making any of those stutter. So it builds once and reuses that
 *  build, runs everything at the lowest priority the scheduler offers, holds
 *  the build to one worker and a bounded heap, and refuses to start at all if
 *  the machine has not got the memory to spare.
 *
 *    npm test
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.TEST_PORT ?? 3102);
const DIST = ".next-test";
const UPLOADS = join(root, ".test/uploads");
const STAMP = join(root, DIST, "built-from");

/** Below this, a run would be taking memory out of somebody's hands. */
const FLOOR_MB = 1500;

/** The password the suite signs in with. Made here, known only to this run. */
const PASSWORD = "test-only-" + randomBytes(6).toString("hex");

const hash = (password) => {
  const salt = randomBytes(16);
  const params = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const key = scryptSync(password.normalize("NFKC"), salt, 32, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join(":");
};

/* ---- being a guest ------------------------------------------------------- */

const available = () => {
  const meminfo = readFileSync("/proc/meminfo", "utf8");
  return Math.round(Number(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] ?? 0) / 1024);
};

/** Lowest scheduling priority, and idle for the disk, where the tools exist. */
const quietly = (command, args) => {
  const has = (name) => spawnSync("sh", ["-c", `command -v ${name}`]).status === 0;
  if (has("ionice")) return ["ionice", ["-c3", "nice", "-n", "19", command, ...args]];
  if (has("nice")) return ["nice", ["-n", "19", command, ...args]];
  return [command, args];
};

const LEAN = {
  /* One worker, a bounded heap: a build that takes a little longer and leaves
     the machine usable while it does. */
  NEXT_DIST_DIR: DIST,
  NEXT_TEST_BUILD: "1",
  NODE_OPTIONS: "--max-old-space-size=1024",
  UV_THREADPOOL_SIZE: "2",
};

/* ---- the database -------------------------------------------------------- */

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

/* ---- what the build was built from --------------------------------------- */

const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout ?? "";

/** HEAD, plus every uncommitted change that could alter the build. Two runs
 *  with the same answer would produce the same site, so the second reuses the
 *  first one's build. */
function treeState() {
  const paths = ["src", "next.config.mjs", "package.json", "package-lock.json", "postcss.config.mjs", "tailwind.config.ts", "tsconfig.json"];
  const sum = createHash("sha1");
  sum.update(git("rev-parse", "HEAD"));
  sum.update(git("diff", "HEAD", "--", ...paths));

  for (const file of git("ls-files", "--others", "--exclude-standard", "--", ...paths).split("\n")) {
    if (!file) continue;
    sum.update(file);
    sum.update(readFileSync(join(root, file)));
  }
  return sum.digest("hex");
}

/* ---- running ------------------------------------------------------------- */

const run = (command, args, env, quiet) =>
  new Promise((resolve, reject) => {
    const [bin, argv] = quietly(command, args);
    const child = spawn(bin, argv, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let said = "";
    if (quiet) {
      child.stdout.on("data", (c) => (said += c));
      child.stderr.on("data", (c) => (said += c));
    }
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}\n${said.slice(-2000)}`)),
    );
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

/* ---- the run ------------------------------------------------------------- */

const url = testUrl();
const base = `http://127.0.0.1:${PORT}`;

const free = available();
if (free < FLOOR_MB) {
  console.error(
    `refusing to run: ${free} MB of memory available, and this wants at least ${FLOOR_MB}.\n` +
      "  The machine is doing something else. Try again when it is not.",
  );
  process.exit(2);
}

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

const state = treeState();
const built = existsSync(STAMP) ? readFileSync(STAMP, "utf8").trim() : "";
const fresh = built === state;

console.log(`  database ${url.replace(/:\/\/[^@]+@/, "://…@")}`);
console.log(`  server   ${base}`);
console.log(`  build    ${fresh ? "reused, nothing has changed since it was made" : "out of date, building once"}`);
console.log(`  memory   ${free} MB available\n`);

rmSync(join(root, ".test"), { recursive: true, force: true });
mkdirSync(UPLOADS, { recursive: true });
await freshDatabase(url);

if (!fresh) {
  const started = Date.now();
  await run("npx", ["next", "build"], { ...LEAN, NODE_ENV: "production" }, true);
  writeFileSync(STAMP, state);
  console.log(`  built in ${Math.round((Date.now() - started) / 1000)}s\n`);
}

const [bin, argv] = quietly("npx", ["next", "start", "-p", String(PORT), "--hostname", "127.0.0.1"]);
const server = spawn(bin, argv, {
  cwd: root,
  /* Its own process group: next runs the server as a child of a child, and
     signalling only the one we spawned leaves the server holding the port. */
  detached: true,
  env: {
    ...process.env,
    ...LEAN,
    NODE_ENV: "production",
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
const started = Date.now();
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

console.log(`\n  ${Math.round((Date.now() - started) / 1000)}s, ${available()} MB available at the end`);
process.exit(failed ? 1 : 0);
