# 💪 Workout Report

A beautiful, modern dashboard for following your [Hevy](https://www.hevy.com/)
workout progress — muscle balance, weekly-goal consistency with a calendar heatmap,
auto-computed coach's notes, volume & time trends, weekday rhythm and
sessions-per-week charts, per‑exercise progression with estimated‑1RM PRs,
body-weight tracking, achievements, a recent‑workout feed, and a global time-range
filter. It's **free to host** (GitHub Pages), refreshes itself on a schedule, and is
**password‑protected**: the data is encrypted at build time and only ever decrypted
in your browser.

## How it works

```
Hevy API ──(GitHub Action, every 6h)──▶ sync ──▶ dataset.json
                                                   │ encrypt with your password
                                                   ▼
                                          dataset.enc.json  (ciphertext only)
                                                   │
                                   vite build ──▶ GitHub Pages (static site)
                                                   │
                       Browser: enter password ──▶ AES‑GCM decrypt ──▶ render
```

- **Your Hevy API key never reaches the browser.** It lives as a GitHub Actions
  secret and is used only at build time to pull your data.
- **Only ciphertext is published.** The build encrypts your data with
  `PBKDF2(SHA‑256) → AES‑GCM` using your `DASHBOARD_PASSWORD`. The published site
  contains nothing readable without that password.
- **Refresh = redeploy.** A scheduled workflow re‑pulls Hevy and redeploys.

> **Security note:** because the encrypted blob is publicly hosted, a *weak*
> password could be brute‑forced offline. Choose a long, strong passphrase.

## One‑time setup

1. **Add two repository secrets** — Settings → *Secrets and variables* → *Actions*:
   - `HEVY_API_KEY` — from the Hevy app (Settings → API).
   - `DASHBOARD_PASSWORD` — the passphrase you'll type to view the dashboard.
2. **Enable Pages** — Settings → *Pages* → *Build and deployment* → Source:
   **GitHub Actions**.
3. **Run it once** — Actions tab → *Sync & Deploy* → *Run workflow*. After it
   finishes, your dashboard is live at
   `https://<your-username>.github.io/<repo-name>/`.

After that it redeploys automatically every 6 hours (and on every push). Trigger a
manual refresh any time from the Actions tab.

> If your Pages **environment is restricted to a specific branch**, either merge
> this branch into your default branch or allow this branch to deploy in
> Settings → Environments → `github-pages`.

## Local development

```bash
cp .env.example .env        # fill in HEVY_API_KEY and DASHBOARD_PASSWORD
npm install
npm run sync                # pull your Hevy data -> data/dataset.json
npm run encrypt             # -> public/data/dataset.enc.json
npm run dev                 # open the printed URL, enter your password
```

`npm run data` runs sync + encrypt together. Plaintext data
(`data/dataset.json`) is git‑ignored and never published.

## Project layout

| Path | Purpose |
| --- | --- |
| `scripts/hevy.ts` | Tiny typed Hevy API client (paginates workouts, resolves templates). |
| `scripts/sync.ts` | Pulls + normalizes your data into `data/dataset.json`. |
| `scripts/encrypt.ts` | Encrypts the dataset into the public blob. |
| `src/crypto/decrypt.ts` | Browser‑side decryption (Web Crypto). |
| `src/data/metrics.ts` | All analytics (muscle balance, volume, streaks, 1RM, PRs…). |
| `src/components/*` | Dashboard UI (React + Tailwind + Recharts). |
| `.github/workflows/deploy.yml` | Scheduled sync + Pages deploy. |

## Tech

Vite · React · TypeScript · Tailwind CSS · Recharts · Framer Motion. No backend,
no database, no third‑party requests at runtime.
