// Gets what GitHub's Mac needs to sign Snöläge for TestFlight / the App
// Store, through the App Store Connect API (the key in secrets ASC_*):
// an Apple Distribution certificate for the CSR it is given and an App Store
// provisioning profile for se.snolage.app with it.
//
// Why not Xcode's automatic signing: archiving with it needs a development
// profile, which needs a registered test device, and the team has none
// ("Your team has no devices", 2026-11-14); forcing "Apple Distribution" on
// automatic signing is refused ("conflicting provisioning settings").
//
// Each run replaces the previous run's profile and certificate (found
// through the profile's name), so the team never fills up its few
// distribution certificates. Revoking a distribution certificate doesn't
// touch apps already on TestFlight or the App Store.
//
// Usage: node ios-signing.mjs <csr.pem> <out dir>
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (the .p8 text), BUNDLE_ID.
// Writes <out>/cert.cer (DER), <out>/profile.mobileprovision, <out>/profile-name.txt.

import { createPrivateKey, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.appstoreconnect.apple.com/v1";
const PROFILE_NAME = "Snolage CI App Store";
const [csrPath, outDir] = process.argv.slice(2);
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 } = process.env;
const BUNDLE_ID = process.env.BUNDLE_ID || "se.snolage.app";
if (!csrPath || !outDir || !ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_P8) {
  console.error("usage: node ios-signing.mjs <csr.pem> <out dir> (with ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 set)");
  process.exit(2);
}

const b64url = (data) => Buffer.from(data).toString("base64url");

function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" }));
  const key = createPrivateKey(ASC_KEY_P8);
  const signature = sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(signature)}`;
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    // Apple's errors say what's wrong (limits, missing capability); never contain the key.
    throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 1500)}`);
  }
  return text ? JSON.parse(text) : null;
}

// 1. The app's identifier.
const ids = await api("GET", `/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=200`);
const bundle = ids.data.find((d) => d.attributes.identifier === BUNDLE_ID);
if (!bundle) throw new Error(`Bundle id ${BUNDLE_ID} is not registered in the team (developer.apple.com → Identifiers).`);

// 2. Remove the previous run's profile and its certificate.
const old = await api("GET", `/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&include=certificates&limit=200`);
for (const profile of old.data.filter((p) => p.attributes.name === PROFILE_NAME)) {
  const certs = profile.relationships?.certificates?.data ?? [];
  await api("DELETE", `/profiles/${profile.id}`);
  for (const cert of certs) {
    await api("DELETE", `/certificates/${cert.id}`).catch((err) => console.warn(`Could not revoke old certificate: ${err.message}`));
  }
  console.log(`Replaced the previous CI profile (${certs.length} certificate(s) revoked).`);
}

// 3. A new distribution certificate for this run's key.
const csr = readFileSync(csrPath, "utf8").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
const cert = await api("POST", "/certificates", {
  data: { type: "certificates", attributes: { certificateType: "DISTRIBUTION", csrContent: csr } },
});
writeFileSync(join(outDir, "cert.cer"), Buffer.from(cert.data.attributes.certificateContent, "base64"));
console.log(`Distribution certificate created (expires ${cert.data.attributes.expirationDate}).`);

// 4. An App Store profile with it (no devices needed for this type).
const profile = await api("POST", "/profiles", {
  data: {
    type: "profiles",
    attributes: { name: PROFILE_NAME, profileType: "IOS_APP_STORE" },
    relationships: {
      bundleId: { data: { type: "bundleIds", id: bundle.id } },
      certificates: { data: [{ type: "certificates", id: cert.data.id }] },
    },
  },
});
writeFileSync(join(outDir, "profile.mobileprovision"), Buffer.from(profile.data.attributes.profileContent, "base64"));
writeFileSync(join(outDir, "profile-name.txt"), PROFILE_NAME);
console.log(`App Store profile "${PROFILE_NAME}" created.`);
