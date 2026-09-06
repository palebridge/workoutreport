import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateEnvelope } from "../src/data/validate.ts";

const ENVELOPE_PATH = "data/dataset.enc.json";
const ENVELOPE_KEYS = ["ciphertext", "iterations", "iv", "kdf", "salt", "v"];

/** A deployment check, never a claim that arbitrary secrets can be recognized. */
export async function checkArtifact(
  directory: string,
): Promise<{ files: number }> {
  const root = resolve(directory);
  const files: string[] = [];
  async function visit(relative = ""): Promise<void> {
    for (const entry of await readdir(resolve(root, relative), {
      withFileTypes: true,
    })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink())
        throw new Error(
          "The published artifact must not contain symbolic links.",
        );
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await visit();
  if (!files.includes(ENVELOPE_PATH))
    throw new Error("The published artifact is missing its encrypted dataset.");
  for (const path of files) {
    if (
      /(^|\/)(?:\.env(?:\..*)?|dataset\.json|[^/]*\.(?:sqlite|db))$/i.test(
        path,
      ) ||
      /\.map$/i.test(path)
    ) {
      throw new Error(
        "The published artifact contains a forbidden plaintext, environment, database, or source-map file.",
      );
    }
    if (path === ENVELOPE_PATH) {
      let value: unknown;
      try {
        value = JSON.parse(await readFile(resolve(root, path), "utf8"));
        validateEnvelope(value);
      } catch {
        throw new Error("The published encrypted dataset is malformed.");
      }
      if (
        Object.keys(value as object)
          .sort()
          .join("|") !== ENVELOPE_KEYS.join("|")
      ) {
        throw new Error(
          "The encrypted dataset contains unexpected plaintext fields.",
        );
      }
      continue;
    }
    if (!/\.(?:js|mjs|cjs|json|html|txt)$/i.test(path)) continue;
    const content = await readFile(resolve(root, path), "utf8");
    if (
      /sports-lab-preview|synthetic-athlete|Synthetic development workout\./.test(
        content,
      ) ||
      /["'](?:workouts|bodyMeasurements)["']\s*:\s*\[\s*\{/.test(content) ||
      /\bstartTime\s*:\s*["']\d{4}-\d{2}-\d{2}T/.test(content)
    ) {
      throw new Error(
        "The published artifact contains a plaintext dataset or development fixture.",
      );
    }
  }
  return { files: files.length };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  checkArtifact(process.argv[2] ?? "dist")
    .then((result) =>
      console.log(
        `Artifact privacy check passed (${result.files} files; encrypted dataset validated).`,
      ),
    )
    .catch((error) => {
      console.error(
        error instanceof Error
          ? error.message
          : "Artifact privacy check failed.",
      );
      process.exitCode = 1;
    });
}
