import { useEffect, useState } from "react";
import { Icon, Wordmark } from "./lab/Icons";
import {
  decryptDataset,
  fetchEncryptedPayload,
  WrongPasswordError,
} from "../crypto/decrypt";
import {
  forgetPassword,
  recallPassword,
  rememberPassword,
} from "../crypto/remember";
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
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [p, saved] = await Promise.all([
          fetchEncryptedPayload(baseUrl),
          recallPassword(),
        ]);
        if (!alive) return;
        setPayload(p);
        if (saved) {
          try {
            const d = await decryptDataset(p, saved);
            if (alive) onUnlock(d, saved);
            return;
          } catch {
            await forgetPassword();
          }
        }
        if (alive) setStatus("ready");
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Could not load data.");
          setStatus("error");
        }
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [baseUrl, onUnlock]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!payload || !password || status !== "ready") return;
    setStatus("decrypting");
    setError(null);
    try {
      const data = await decryptDataset(payload, password);
      if (remember) await rememberPassword(password);
      else await forgetPassword();
      onUnlock(data, password);
    } catch (err) {
      setStatus("ready");
      setError(
        err instanceof WrongPasswordError
          ? "That password does not match, or the snapshot is damaged. Try again."
          : err instanceof Error
            ? err.message
            : "Could not unlock the snapshot.",
      );
    }
  }
  return (
    <div className="gate">
      <div className="gate-brand">
        <Wordmark />
      </div>
      <section className="gate-intro">
        <p className="eyebrow">Your personal training lab</p>
        <h1>
          Every session.
          <br />
          <span className="text-muted">A bigger picture.</span>
        </h1>
        <p>
          Find the progress in your training. Follow the patterns. See what the
          work adds up to.
        </p>
        <div className="gate-lines" aria-hidden="true">
          {[
            22, 30, 25, 36, 32, 44, 38, 48, 56, 50, 60, 64, 58, 70, 65, 75, 85,
            78, 92, 100,
          ].map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </section>
      <section className="gate-form">
        <span className="tag">
          <Icon name="lock" size={14} /> Private workspace
        </span>
        <h2>Welcome back.</h2>
        <p>Unlock your training history to take a closer look.</p>
        {status === "loading" ? (
          <p className="gate-loading" role="status">
            Loading your encrypted snapshot…
          </p>
        ) : status === "error" ? (
          <div className="gate-loading">
            <p className="form-error" role="alert">
              {error}
            </p>
            <button className="text-button" onClick={() => location.reload()}>
              Try again
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="password">
              Dashboard password
              <input
                id="password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                aria-invalid={!!error}
                aria-describedby={error ? "unlock-error" : undefined}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />{" "}
              Remember on this device
            </label>
            <button
              type="submit"
              className="button primary"
              disabled={status !== "ready" || !password}
            >
              {status === "decrypting" ? "Unlocking…" : "Enter your workspace"}
              <Icon name="arrow" size={18} />
            </button>
            {error && (
              <p className="form-error" id="unlock-error" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
        <p className="gate-footnote">
          Your history is decrypted here in your browser. Your password never
          leaves this device.
        </p>
      </section>
    </div>
  );
}
