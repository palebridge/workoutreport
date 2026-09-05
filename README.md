# Workout Report

A personal training lab built around your [Hevy](https://www.hevy.com/) workout history. Follow progress across exercises, inspect the sessions behind a pattern, and experiment with a hypothetical training week. The interface was developed with AI; its analysis runs deterministically in your browser, with no ongoing AI service, model API key, or inference charge.

The site remains a static, password-protected GitHub Pages application. Workout data is encrypted before publishing and decrypted in browser memory after you unlock it.

## Four ways to explore

| View             | What it does                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**     | A connected training atlas, recent changes, weekly rhythm, and the latest session. Switch between recorded values and change relative to the first eligible observation.                |
| **Explore**      | Lifts, Sessions, and Patterns modes. Filter exercises, inspect progression and original sets, compare two sessions, and follow muscle-by-week cells or calendar days to their workouts. |
| **Scenario lab** | Copy a completed week, move or repeat sessions, adjust eligible resistance sets, and compare the resulting workload and rough historical time estimate.                                 |
| **Journey**      | Gym Buddy, Boss Battle, Iron Mountain, records, trophies, and milestone history. Weekly goals and current-month battles have explicit calendar rules.                                   |

Overview and Explore share a date range, preceding-period comparison, calendar timezone, and warmup toggle. The default is the last 28 calendar days, including today. Journey uses full history; the Scenario lab uses its selected source week. Weight display can switch between kilograms and pounds.

Charts and tables link back to the original logged sessions. **How calculated** explains the main rules in the interface; [the analytics reference](docs/analytics.md) documents formulas, missing-data behavior, and limitations. This is a way to understand recorded training and workload, not a prediction of strength gains, recovery, or injury risk.

## How data reaches the site

```text
Hevy API
  -> GitHub Actions sync and validation
  -> data/dataset.json                 local/build workspace only
  -> password-based encryption
  -> public/data/dataset.enc.json      ciphertext
  -> Vite build and artifact check
  -> GitHub Pages
  -> unlock and explore in browser memory
```

- The Hevy API key is used by the sync script; it is never sent to the browser.
- Encryption uses PBKDF2 with SHA-256 and AES-256-GCM, with a new salt and IV for each encrypted snapshot.
- Core workout counts are reconciled before a snapshot is accepted. Optional source failures remain visible as coverage statuses instead of fabricated values.
- **Check for updates** downloads the latest deployed encrypted snapshot. It does not contact Hevy or start a deployment. **Run Hevy sync** opens the GitHub workflow page.
- A successful unchanged sync updates freshness without replacing the analytical dataset. Changed content invalidates old scenario drafts.

The encrypted blob is publicly downloadable. Use a long, strong dashboard passphrase because an attacker can attempt password guesses offline. Browser encryption protects the stored payload; someone who can use an unlocked browser profile can see the unlocked dashboard.

**Remember this device** stores the password encrypted under a non-extractable device key in IndexedDB. The encrypted remembered value lives in localStorage. **Lock and forget this device** clears remembered access and returns to the gate. When storage is unavailable, preference changes still work for the current visit and remembered access falls back to asking for the password again.

## One-time GitHub Pages setup

1. Add repository secrets under **Settings → Secrets and variables → Actions**:
   - `HEVY_API_KEY`: your Hevy API key from the Hevy app.
   - `DASHBOARD_PASSWORD`: the passphrase used to encrypt and unlock your data.
2. Under **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Open **Actions → Sync & Deploy → Run workflow** and run the deployment branch.
4. Open the Pages URL shown by the successful deployment, normally `https://<your-username>.github.io/<repo-name>/`.

The scheduled workflow targets 00:17, 06:17, 12:17, and 18:17 UTC. GitHub runs scheduled workflows from the default branch and can delay them; [GitHub's scheduling documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) describes those constraints. The workflow also supports manual dispatch and pushes to the branches listed in [deploy.yml](.github/workflows/deploy.yml).

If the `github-pages` environment restricts deployment branches, allow the intended deployment branch or merge the changes into one already permitted. All runs of **Sync & Deploy** publish to the same Pages site.

## Local development

Use **Node.js 22** and the checked-in npm lockfile.

For a development preview without a Hevy account or any real data:

```sh
npm ci
npm run fixture
npm run dev
```

Unlock the local preview with **`sports-lab-preview`**. `npm run fixture` creates an encrypted, entirely synthetic snapshot at `public/data/dataset.enc.json`; it replaces the local encrypted snapshot if one already exists. The fixture generator is a development script backed by `tests/fixture.ts`. Do not import fixtures or their password into production UI code. Real deployments run the Hevy sync and encryption steps instead.

To develop with your own history, copy `.env.example` to `.env`, fill in the two secrets, then run:

```sh
npm ci
npm run data
npm run dev
```

`npm run data` runs sync and encryption. Both scripts load the repository-root `.env` using Node 22's `process.loadEnvFile`; values already present in the process environment take precedence. The entire root `data/` directory, encrypted local payload, environment files, and temporary writes are ignored by Git.

Vite defaults to `/workoutreport/`. For a custom domain or different project path, set `BASE_PATH` in the shell environment before building. The deploy workflow supplies the repository path automatically. Configure `REPO` in `src/config.ts` when adapting the workflow link for another repository.

## Checks and review workflow

```sh
npm test                # analytical, calendar, scenario, sync, crypto and privacy tests
npm run check           # type checks + tests + production build + artifact privacy
npm run preview         # serve the built site locally
```

Generate an encrypted snapshot with `npm run fixture` or `npm run data` before `npm run check`; the privacy check requires `dist/data/dataset.enc.json`. `npm run typecheck` and `npm run check:privacy` can also run separately.

For feature work, open a pull request. **Verify pull request** builds against encrypted synthetic data with read-only repository permissions and no Hevy or dashboard secrets. It does not deploy a preview. After review, merge into the configured deployment branch. To explicitly deploy a feature branch, select it in **Sync & Deploy → Run workflow** and ensure the Pages environment allows that branch; this updates the existing Pages site.

The deployment workflow runs tests before accessing Hevy, then encrypts, builds, checks the artifact, and uploads only `dist`. A failed sync, validation, encryption, build, or privacy check stops that deployment. The previous successful Pages deployment remains the live version.

## Implementation

React 18, TypeScript, Vite, Tailwind, Recharts, and Framer Motion. Fonts and application assets are served with the site. There is no application server, hosted database, runtime Hevy request, or runtime AI request.

The active interface is in `src/components/lab/`. Shared analytical rules live in `src/data/analysis.ts`, `calendar.ts`, `records.ts`, and `scenario.ts`; retained Journey calculations live in `metrics.ts` and `game.ts`. Sync and encryption are under `scripts/`, with browser cryptography under `src/crypto/`.
