// Encrypt data/dataset.json with the dashboard password so only ciphertext is
// ever published. Uses PBKDF2(SHA-256) -> AES-GCM via the Web Crypto API, the
// exact same primitives the browser uses to decrypt (see src/crypto/decrypt.ts).
//
// Usage: DASHBOARD_PASSWORD=... npm run encrypt

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { EncryptedPayload } from "../src/data/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN = resolve(__dirname, "../data/dataset.json");
const OUT = resolve(__dirname, "../public/data/dataset.enc.json");

const ITERATIONS = 200_000;

async function main() {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    console.error("✗ DASHBOARD_PASSWORD is not set. Add it to .env or your shell.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.warn("⚠ DASHBOARD_PASSWORD is short — the public blob is brute-forceable. Use 12+ chars.");
  }

  const plaintext = await readFile(IN, "utf8").catch(() => {
    console.error(`✗ ${IN} not found. Run "npm run sync" first.`);
    process.exit(1);
  });

  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext as string),
  );

  const payload: EncryptedPayload = {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(new Uint8Array(ciphertext)),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload), "utf8");
  const kb = (JSON.stringify(payload).length / 1024).toFixed(1);
  console.log(`✓ Wrote ${OUT} (${kb} KB encrypted)`);
}

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

main().catch((err) => {
  console.error("✗ Encrypt failed:", err);
  process.exit(1);
});
