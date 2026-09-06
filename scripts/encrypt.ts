// Validate and encrypt the snapshot. Only ciphertext belongs in public/data.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  contentHash,
  validateDataset,
  validateEnvelope,
} from "../src/data/validate.ts";
import { encryptText } from "../src/crypto/encrypt.ts";
import type { EncryptedPayload } from "../src/data/types.ts";
import { loadLocalEnv, writeJsonAtomically } from "./sync.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function encryptDataset(
  input: unknown,
  password: string,
): Promise<EncryptedPayload> {
  if (!password)
    throw new Error(
      "DASHBOARD_PASSWORD is not set. Add it to .env or your shell.",
    );
  const dataset = validateDataset(input);
  const fingerprint = await contentHash(dataset);
  if (
    dataset.schemaVersion === 2 &&
    dataset.contentFingerprint !== fingerprint
  ) {
    throw new Error(
      "Dataset content fingerprint does not match. Run sync again.",
    );
  }
  // Legacy snapshots can still be encrypted; all new output carries validated metadata.
  const current = {
    ...dataset,
    schemaVersion: 2 as const,
    contentFingerprint: fingerprint,
  };
  return validateEnvelope(await encryptText(JSON.stringify(current), password));
}
async function main(): Promise<void> {
  loadLocalEnv();
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password)
    throw new Error(
      "DASHBOARD_PASSWORD is not set. Add it to .env or your shell.",
    );
  if (password.length < 12)
    console.warn(
      "Use a long dashboard passphrase; the encrypted file is publicly hosted.",
    );
  const plaintext = await readFile(resolve(ROOT, "data/dataset.json"), "utf8");
  let input: unknown;
  try {
    input = JSON.parse(plaintext);
  } catch {
    throw new Error("Invalid JSON in local dataset. Run sync again.");
  }
  const encrypted = await encryptDataset(input, password);
  await writeJsonAtomically(
    resolve(ROOT, "public/data/dataset.enc.json"),
    encrypted,
  );
  console.log("Validated and encrypted the dashboard snapshot.");
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Encryption failed.",
    );
    process.exitCode = 1;
  });
}
