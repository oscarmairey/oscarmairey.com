import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

/** One user, one password, no user table.
 *
 *  The password is stored as a scrypt hash in ADMIN_PASSWORD_HASH and never
 *  reaches the database. The session is a signed token in an httpOnly cookie:
 *  nothing is kept server-side, so there is no session store to grow stale, and
 *  changing SESSION_SECRET signs every existing session out at once. */

const COOKIE = "om_session";
const MAX_AGE = 60 * 60 * 24 * 30; // thirty days
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer, params: typeof SCRYPT): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, params.keylen, params, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** `scrypt:N:r:p:salt:key`, salt and key base64url.
 *
 *  Not the usual `$`-separated PHC string, and not plain base64, on purpose:
 *  this value lives in a .env file, and dotenv expands `$name` and mangles the
 *  hash on the way in. Colons and base64url survive that untouched. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, SCRYPT);
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join(":");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, salt, expectedB64] = parts;
  const expected = Buffer.from(expectedB64, "base64url");
  if (expected.length === 0) return false;

  const key = await derive(password, Buffer.from(salt, "base64url"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    keylen: expected.length,
    maxmem: SCRYPT.maxmem,
  });

  return key.length === expected.length && timingSafeEqual(key, expected);
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  }
  return value;
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

function issue(): string {
  const payload = `v1.${Date.now() + MAX_AGE * 1000}`;
  return `${payload}.${sign(payload)}`;
}

function valid(token: string): boolean {
  const cut = token.lastIndexOf(".");
  if (cut < 1) return false;

  const payload = token.slice(0, cut);
  const given = Buffer.from(token.slice(cut + 1));
  const wanted = Buffer.from(sign(payload));
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return false;

  const [version, expiry] = payload.split(".");
  return version === "v1" && Number(expiry) > Date.now();
}

/** Secure is set whenever the request arrived over TLS, which behind Caddy it
 *  always does in production. Plain http on localhost stays testable.
 *
 *  There is no way to sign out, because there was never a reason to: the
 *  session is one person's, on one machine, and it expires by itself. */
async function overTls(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return process.env.NODE_ENV === "production";
}

export async function startSession() {
  (await cookies()).set(COOKIE, issue(), {
    httpOnly: true,
    secure: await overTls(),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function signedIn(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    return valid(token);
  } catch {
    /* A missing SESSION_SECRET means nobody is signed in, not a crash. */
    return false;
  }
}

/** Guard for every admin page and every write action. */
export async function requireSession() {
  if (!(await signedIn())) redirect("/admin/login");
}

/** Best-effort client identity for rate limiting. */
export async function client(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
