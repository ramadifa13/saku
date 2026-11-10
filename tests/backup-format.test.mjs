import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

test("backup envelope round-trips and rejects a wrong password", () => {
  const password = "a-long-backup-password";
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ version: 2, vault: [{ title: "x", payload: { secret: "y" } }] })), cipher.final()]);
  const envelope = { format: "SAKU", version: 2, salt, iv, tag: cipher.getAuthTag(), body };
  const open = (pass) => { const k = crypto.scryptSync(pass, envelope.salt, 32, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }); const d = crypto.createDecipheriv("aes-256-gcm", k, envelope.iv); d.setAuthTag(envelope.tag); return JSON.parse(Buffer.concat([d.update(envelope.body), d.final()]).toString()); };
  assert.equal(open(password).version, 2);
  assert.throws(() => open("wrong-password"));
});
