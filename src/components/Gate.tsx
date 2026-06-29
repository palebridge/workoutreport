import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { decryptDataset, fetchEncryptedPayload, WrongPasswordError } from "../crypto/decrypt";
import type { Dataset, EncryptedPayload } from "../data/types";

type Status = "loading" | "ready" | "decrypting" | "error";

export function Gate({
  baseUrl,
  onUnlock,
}: {
  baseUrl: string;
  onUnlock: (d: Dataset, password: string) => void;
}) {
  const [payload, setPayload] = useState<EncryptedPayload | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchEncryptedPayload(baseUrl)
      .then((p) => {
        if (!alive) return;
        setPayload(p);
        setStatus("ready");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load data.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [baseUrl]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload || !password) return;
    setStatus("decrypting");
    setError(null);
    try {
      const data = await decryptDataset(payload, password);
      onUnlock(data, password);
    } catch (err) {
      setStatus("ready");
      setError(
        err instanceof WrongPasswordError
          ? "That password doesn't match. Try again."
          : "Something went wrong decrypting the data.",
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="card w-full max-w-sm text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-glow-violet to-glow-indigo text-3xl shadow-glow">
          💪
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
          Workout Report
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Your training, decrypted in your browser.
        </p>

        {status === "error" ? (
          <p className="mt-6 rounded-xl border border-glow-rose/30 bg-glow-rose/10 px-3 py-2 text-sm text-glow-rose">
            {error}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-center text-white placeholder:text-slate-500 outline-none transition focus:border-glow-violet/60 focus:ring-2 focus:ring-glow-violet/30"
            />
            <button
              type="submit"
              disabled={status !== "ready" || !password}
              className="w-full rounded-xl bg-gradient-to-r from-glow-violet to-glow-indigo px-4 py-3 font-medium text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "loading"
                ? "Loading…"
                : status === "decrypting"
                  ? "Unlocking…"
                  : "Unlock"}
            </button>
            {error && <p className="text-sm text-glow-rose">{error}</p>}
          </form>
        )}
      </motion.div>
    </div>
  );
}
