#!/usr/bin/env node
/** Prints the ADMIN_PASSWORD_HASH line for a password, so a new password never
 *  has to travel through anything but this terminal.
 *
 *    node scripts/hash-password.mjs 'the new password'
 *    node scripts/hash-password.mjs          # generates one and prints it once
 *
 *  Kept in step with src/lib/auth.ts by using the same parameters and format. */

import { randomBytes, scrypt } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 };

const derive = (password, salt) =>
  new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, SCRYPT.keylen, SCRYPT, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

const generated = process.argv[2] ? null : randomBytes(18).toString("base64url");
const password = process.argv[2] ?? generated;

const salt = randomBytes(16);
const key = await derive(password, salt);
const hash = ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");

if (generated) console.log(`password: ${generated}`);
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
