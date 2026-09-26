// Creates the VAPID key pair for web push notifications and stores both
// halves as secrets on the deployed worker. Run once, from the worker folder:
//
//   node scripts/setup-push.mjs
//
// Refuses to replace existing keys: every browser subscription is tied to
// the public key, so new keys would silently break all of them.
import { execSync, spawnSync } from "node:child_process";
import { webcrypto } from "node:crypto";

const run = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], shell: true });

const existing = run("npx wrangler secret list");
if (existing.includes("VAPID_PRIVATE_KEY") && !process.argv.includes("--force")) {
  console.log("Notisnycklar finns redan på workern – inget ändrat.");
  process.exit(0);
}

const toB64Url = (bytes) => Buffer.from(bytes).toString("base64url");
const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicKey = toB64Url(new Uint8Array(await webcrypto.subtle.exportKey("raw", pair.publicKey)));
const privateKey = (await webcrypto.subtle.exportKey("jwk", pair.privateKey)).d;

for (const [name, value] of [
  ["VAPID_PUBLIC_KEY", publicKey],
  ["VAPID_PRIVATE_KEY", privateKey],
]) {
  const result = spawnSync("npx", ["wrangler", "secret", "put", name], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });
  if (result.status !== 0) {
    console.error(`Kunde inte spara ${name}.`);
    process.exit(1);
  }
}
console.log("Klart! Notiser är aktiverade. Den privata nyckeln har inte skrivits ut någonstans.");
