import type { EncryptedPayload } from "../data/types";

export async function encryptText(
  plaintext: string,
  password: string,
): Promise<EncryptedPayload> {
  const enc = new TextEncoder(),
    salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 200_000;
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  const b64 = (bytes: Uint8Array) => {
    let text = "";
    for (const b of bytes) text += String.fromCharCode(b);
    return btoa(text);
  };
  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(new Uint8Array(ciphertext)),
  };
}
