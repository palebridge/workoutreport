// "Remember this device": the password is encrypted with a random,
// NON-EXTRACTABLE AES-GCM key that lives only in IndexedDB (CryptoKey objects
// are structured-clonable but the key material can't be exported by script).
// The ciphertext sits in localStorage. So the password is never stored in
// plain text — someone would need this exact browser profile to unlock.
// Everything degrades gracefully (private mode, blocked storage): we just ask
// for the password again.

const DB_NAME = "wr-device";
const STORE = "keys";
const KEY_ID = "device-key";
const LS_KEY = "wr.remember";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const db = await openDb();
  try {
    const existing = (await idbGet(db, KEY_ID)) as CryptoKey | undefined;
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await idbPut(db, KEY_ID, key);
    return key;
  } finally {
    db.close();
  }
}

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function rememberPassword(password: string): Promise<void> {
  try {
    const key = await getOrCreateDeviceKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(password),
    );
    localStorage.setItem(LS_KEY, JSON.stringify({ iv: b64(iv), ct: b64(new Uint8Array(ct)) }));
  } catch {
    // Storage unavailable — silently fall back to asking every time.
  }
}

export async function recallPassword(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { iv, ct } = JSON.parse(raw) as { iv: string; ct: string };
    const db = await openDb();
    let key: CryptoKey | undefined;
    try {
      key = (await idbGet(db, KEY_ID)) as CryptoKey | undefined;
    } finally {
      db.close();
    }
    if (!key) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export async function forgetPassword(): Promise<void> {
  try {
    localStorage.removeItem(LS_KEY);
    const db = await openDb();
    try {
      await idbDelete(db, KEY_ID);
    } finally {
      db.close();
    }
  } catch {
    // Best effort.
  }
}
