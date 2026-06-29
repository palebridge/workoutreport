// Personal display name shown in the dashboard header. Set to null to fall back
// to your Hevy username.
export const DISPLAY_NAME: string | null = "Pål Espen";

// "owner/repo" — used to deep-link the "Sync from Hevy" action to the workflow
// run page. Set to null to hide that link.
export const REPO: string | null = "palebridge/workoutreport";

/** URL of the "Sync & Deploy" workflow, or null if REPO is unset. */
export const WORKFLOW_URL = REPO
  ? `https://github.com/${REPO}/actions/workflows/deploy.yml`
  : null;
