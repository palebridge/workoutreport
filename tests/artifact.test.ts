import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { checkArtifact } from "../scripts/check-artifact";
import { encryptText } from "../src/crypto/encrypt";

test("artifact check accepts ciphertext and rejects exposed data, fixture code, and envelope fields", async () => {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, "workoutreport-artifact-test-"));
  if (
    dirname(resolve(directory)) !== parent ||
    !basename(directory).startsWith("workoutreport-artifact-test-")
  ) {
    throw new Error("Unexpected test directory.");
  }
  try {
    await mkdir(join(directory, "data"));
    const payload = await encryptText(
      '{"workouts":[{"title":"Private fixture"}]}',
      "fixture-password",
    );
    const ciphertextFile = join(directory, "data/dataset.enc.json");
    await writeFile(ciphertextFile, JSON.stringify(payload));
    await writeFile(
      join(directory, "index.html"),
      "<main>Workout Report</main>",
    );
    assert.deepEqual(await checkArtifact(directory), { files: 2 });
    for (const [filename, value] of [
      ["data/dataset.json", "{}"],
      [".env", "PRIVATE_TEST_VALUE"],
      ["fixture.js", 'const user = "synthetic-athlete";'],
      ["other.json", '{"workouts":[{"id":"private"}]}'],
      ["source.js.map", "{}"],
    ]) {
      const path = join(directory, filename);
      await writeFile(path, value);
      await assert.rejects(checkArtifact(directory));
      await rm(path);
    }
    await writeFile(
      ciphertextFile,
      JSON.stringify({
        ...payload,
        workouts: [{ title: "PRIVATE_TEST_VALUE" }],
      }),
    );
    await assert.rejects(
      checkArtifact(directory),
      (error) =>
        error instanceof Error &&
        error.message.includes("plaintext fields") &&
        !error.message.includes("PRIVATE_TEST_VALUE"),
    );
    await writeFile(ciphertextFile, "MALFORMED_PRIVATE_TEST_VALUE");
    await assert.rejects(
      checkArtifact(directory),
      (error) =>
        error instanceof Error &&
        error.message.includes("malformed") &&
        !error.message.includes("PRIVATE_TEST_VALUE"),
    );
    await rm(ciphertextFile);
    await assert.rejects(
      checkArtifact(directory),
      /missing its encrypted dataset/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
