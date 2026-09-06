// Browser-side counterpart to scripts/encrypt.ts. Derives an AES-GCM key from
// the password via PBKDF2(SHA-256) and decrypts the published blob. The
// plaintext never leaves memory.

import type { Dataset, EncryptedPayload } from "../data/types";
import {
  contentHash,
  validateDataset,
  validateEnvelope,
} from "../data/validate";

export class WrongPasswordError extends Error {
  constructor() {
    super("Incorrect password");
    this.name = "WrongPasswordError";
  }
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function fetchEncryptedPayload(
  baseUrl: string,
): Promise<EncryptedPayload> {
  // Cache-bust so a freshly redeployed snapshot is picked up immediately.
  const res = await fetch(`${baseUrl}data/dataset.enc.json?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not load data (HTTP ${res.status}).`);
  return validateEnvelope(await res.json());
}

export async function decryptDataset(
  payload: EncryptedPayload,
  password: string,
): Promise<Dataset> {
  payload = validateEnvelope(payload);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromB64(payload.salt),
      iterations: payload.iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(payload.iv) },
      key,
      fromB64(payload.ciphertext),
    );
  } catch {
    // AES-GCM authentication failure == wrong password (or corrupt blob).
    throw new WrongPasswordError();
  }

  const dataset = validateDataset(
    JSON.parse(new TextDecoder().decode(plaintext)),
  );
  const hash = await contentHash(dataset);
  if (dataset.schemaVersion === 2 && dataset.contentFingerprint !== hash) {
    throw new Error(
      "The snapshot content does not match its fingerprint. Sync again.",
    );
  }
  dataset.contentFingerprint = hash;
  return dataset;
}
