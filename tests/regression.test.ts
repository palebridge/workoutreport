import assert from "node:assert/strict";
import test from "node:test";
import { setVolumeKg } from "../src/data/metrics";
import { loadVolume } from "../src/data/analysis";
import { fixture } from "./fixture";
import { encryptText } from "../src/crypto/encrypt";
import { decryptDataset, WrongPasswordError } from "../src/crypto/decrypt";
import { contentHash, validateDataset } from "../src/data/validate";

test("negative assistance cannot subtract from either workload or Journey volume", () => {
  const set = {
    ...fixture(1).workouts[0].exercises[0].sets[0],
    weightKg: -25,
    reps: 10,
  };
  assert.equal(setVolumeKg(set), 0);
  assert.equal(loadVolume(set), 0);
});
test("wrong passwords and changed authenticated fingerprints fail closed", async () => {
  const data = validateDataset(fixture(1));
  data.schemaVersion = 2;
  data.contentFingerprint = await contentHash(data);
  const payload = await encryptText(
    JSON.stringify(data),
    "regression-password",
  );
  await assert.rejects(
    decryptDataset(payload, "wrong-password"),
    WrongPasswordError,
  );
  const incorrect = await encryptText(
    JSON.stringify({ ...data, contentFingerprint: "0".repeat(64) }),
    "regression-password",
  );
  await assert.rejects(
    decryptDataset(incorrect, "regression-password"),
    /fingerprint/,
  );
});
