import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

function derive(password, salt) {
  return crypto.scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
}
function seal(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), body };
}
function open(payload, key) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, payload.iv);
  decipher.setAuthTag(payload.tag);
  return JSON.parse(Buffer.concat([decipher.update(payload.body), decipher.final()]).toString());
}

test("scrypt PIN derivation is deterministic for the same salt", () => {
  const salt = crypto.randomBytes(16);
  assert.deepEqual(derive("123456", salt), derive("123456", salt));
  assert.notDeepEqual(derive("123456", salt), derive("654321", salt));
});

test("AES-256-GCM detects tampering", () => {
  const key = crypto.randomBytes(32);
  const payload = seal({ secret: "vault" }, key);
  assert.deepEqual(open(payload, key), { secret: "vault" });
  payload.body[0] ^= 1;
  assert.throws(() => open(payload, key));
});
