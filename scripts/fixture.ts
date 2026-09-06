import { mkdir, writeFile } from "node:fs/promises";
import { fixture } from "../tests/fixture.ts";
import { contentHash, validateDataset } from "../src/data/validate.ts";
import { encryptText } from "../src/crypto/encrypt.ts";

const data = validateDataset(fixture());
data.schemaVersion = 2;
data.contentFingerprint = await contentHash(data);
await mkdir("public/data", { recursive: true });
await writeFile(
  "public/data/dataset.enc.json",
  JSON.stringify(await encryptText(JSON.stringify(data), "sports-lab-preview")),
);
console.log("Synthetic preview ready. Unlock with: sports-lab-preview");
