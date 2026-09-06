import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import type { Dataset } from "../../data/types";

import {
  addDays,
  defaultTimezone,
  localDay,
  precedingRange,
} from "../../data/calendar";

import type { AnalysisContext, DateRange } from "../../data/calendar";

import type { Finding } from "../../data/analysis";

import { rangeLabel } from "../../data/analysis";

import { forgetPassword } from "../../crypto/remember";

import { useUnit } from "../../hooks/useUnit";

import { WORKFLOW_URL } from "../../config";

import Overview from "./Overview";

import { Icon, Wordmark } from "./Icons";

import type { IconName } from "./Icons";

import { WorkoutDetail } from "./shared";

import type { ScenarioDraft } from "../../data/scenario";

const Explore = lazy(() => import("./Explore"));

const Lab = lazy(() => import("./Lab"));

const JourneyView = lazy(() => import("./JourneyView"));

type View = "overview" | "explore" | "lab" | "journey";

const views: { id: View; title: string; icon: IconName }[] = [
  { id: "overview", title: "Overview", icon: "overview" },
  { id: "explore", title: "Explore", icon: "explore" },
  { id: "lab", title: "Scenario lab", icon: "lab" },
  { id: "journey", title: "Journey", icon: "journey" },
];

function readView(): View {
  const value = location.hash.slice(2);
  return views.some((v) => v.id === value) ? (value as View) : "overview";
}

export default function SportsLab({
  dataset,
  syncedAt,
  onRefresh,
}: {
  dataset: Dataset;
  syncedAt: string;
  onRefresh: () => Promise<{ changed: boolean }>;
}) {
  const [view, setView] = useState<View>(readView),
    [timezone, setTimezone] = useState(defaultTimezone),
    [now, setNow] = useState(() => new Date().toISOString());

  const [rangeWeeks, setRangeWeeks] = useState("4"),
    [custom, setCustom] = useState<DateRange>(() => ({
      start: addDays(localDay(now, timezone), -27),
      end: localDay(now, timezone),
    }));

  const [compare, setCompare] = useState(true),
    [includeWarmups, setIncludeWarmups] = useState(false),
    [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);

  const [refreshStatus, setRefreshStatus] = useState(""),
    [settings, setSettings] = useState(false);

  const { unit, toggle } = useUnit();

  const [rangeError, setRangeError] = useState("");
  const [selection, setSelection] = useState<Finding["target"]>({
    mode: "lifts",
  });

  const [draft, setDraft] = useState<ScenarioDraft | null>(null);

  const today = localDay(now, timezone);

  const context = useMemo<AnalysisContext>(() => {
    const range =
      rangeWeeks === "custom"
        ? custom
        : {
            start:
              rangeWeeks === "all"
                ? dataset.workouts[0]
                  ? localDay(dataset.workouts[0].startTime, timezone)
                  : today
                : addDays(today, -Number(rangeWeeks) * 7 + 1),
            end: today,
          };

    return {
      range,
      comparison:
        compare && rangeWeeks !== "all" ? precedingRange(range) : null,
      timezone,
      now: new Date().toISOString(),
      includeWarmups,
    };
  }, [
    rangeWeeks,
    custom,
    compare,
    timezone,
    includeWarmups,
    dataset.workouts,
    today,
  ]);

  useEffect(() => {
    const listener = () => setView(readView());
    window.addEventListener("hashchange", listener);
    const timer = window.setInterval(
      () => setNow(new Date().toISOString()),
      60000,
    );
    return () => {
      window.removeEventListener("hashchange", listener);
      clearInterval(timer);
    };
  }, []);

  const navigate = (next: View) => {
    setView(next);
    location.hash = `/${next}`;
    window.scrollTo({ top: 0 });
  };

  const explore = (target: Finding["target"]) => {
    setSelection(target);
    navigate("explore");
  };

  const age = Math.max(0, (Date.parse(now) - Date.parse(syncedAt)) / 3600000);

  const workout = dataset.workouts.find((w) => w.id === selectedWorkout);

  async function refresh() {
    if (refreshStatus === "Checking…") return;
    setRefreshStatus("Checking…");
    try {
      const result = await onRefresh();
      setRefreshStatus(
        result.changed ? "New data loaded" : "Latest snapshot loaded",
      );
    } catch {
      setRefreshStatus("Could not refresh. Try again.");
    }
  }

  return (
    <div className="sports-lab">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <Wordmark />
        <p className="sidebar-caption">Personal training lab</p>
        <nav aria-label="Main navigation">
          {views.map((v) => (
            <button
              key={v.id}
              aria-label={v.title}
              className={`nav-item ${view === v.id ? "active" : ""}`}
              aria-current={view === v.id ? "page" : undefined}
              onClick={() => navigate(v.id)}
            >
              <Icon name={v.icon} />
              <span>{v.title}</span>
              {view === v.id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-status">
            <Icon name="lock" size={16} />
            <span>Your data stays yours.</span>
          </div>
          <p>
            Encrypted at rest.
            <br />
            Explored in your browser.
          </p>
          <div className="sidebar-athlete">
            <span className="avatar">
              {(dataset.user?.name ?? "You").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{dataset.user?.name ?? "Your training"}</strong>
              <small>Personal workspace</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{views.find((v) => v.id === view)?.title}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`sync-status ${age >= 12 ? "stale" : ""}`}>
              <i />
              {age < 1 ? "Synced recently" : `Synced ${Math.floor(age)}h ago`}
            </span>
            <button
              className="unit-button"
              onClick={toggle}
              aria-label={`Units: ${unit}. Switch units.`}
            >
              {unit.toUpperCase()}
            </button>
            <button
              className="icon-button"
              onClick={() => setSettings(!settings)}
              aria-label="Data and display settings"
              aria-expanded={settings}
            >
              <Icon name="info" />
            </button>
            <button
              className="icon-button"
              aria-label="Lock and forget this device"
              onClick={() =>
                void forgetPassword().finally(() => location.reload())
              }
            >
              <Icon name="lock" />
            </button>
          </div>
        </header>

        {settings && (
          <div className="settings-panel">
            <label>
              Calendar timezone
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {[
                  ...new Set([
                    defaultTimezone(),
                    "Europe/Oslo",
                    "UTC",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Asia/Tokyo",
                  ]),
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <div>
              <strong>Last successful sync</strong>
              <p>{new Date(syncedAt).toLocaleString()}</p>
              <p className="small muted">
                Check loads the latest published snapshot. Hevy sync runs
                separately.
              </p>
            </div>
            <button className="button" onClick={refresh}>
              <Icon name="refresh" size={16} />
              {refreshStatus || "Check for updates"}
            </button>
            {WORKFLOW_URL && (
              <a
                className="text-button"
                href={WORKFLOW_URL}
                target="_blank"
                rel="noreferrer"
              >
                Run Hevy sync ↗
              </a>
            )}
            <div className="source-statuses">
              {Object.entries(dataset.sources ?? {}).map(([key, value]) => (
                <span key={key}>
                  {key}: {value.status} ({value.received})
                </span>
              ))}
            </div>
          </div>
        )}

        <main id="main-content" tabIndex={-1}>
          <div className="page-controls">
            <span className="period-label">
              {view === "journey"
                ? "All history · current-month battles"
                : view === "lab"
                  ? "Hypothetical week · source history unchanged"
                  : rangeLabel(context.range)}
            </span>
            {(view === "overview" || view === "explore") && (
              <div className="range-controls">
                <label className="sr-only" htmlFor="date-range">
                  Date range
                </label>
                <select
                  id="date-range"
                  value={rangeWeeks}
                  onChange={(e) => setRangeWeeks(e.target.value)}
                >
                  <option value="4">Last 4 weeks</option>
                  <option value="12">Last 12 weeks</option>
                  <option value="26">Last 26 weeks</option>
                  <option value="all">All history</option>
                  <option value="custom">Custom range</option>
                </select>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={compare}
                    disabled={rangeWeeks === "all"}
                    onChange={(e) => setCompare(e.target.checked)}
                  />{" "}
                  Compare
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeWarmups}
                    onChange={(e) => setIncludeWarmups(e.target.checked)}
                  />{" "}
                  Warmups
                </label>
              </div>
            )}
          </div>

          {rangeWeeks === "custom" &&
            (view === "overview" || view === "explore") && (
              <form
                className="custom-range"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fields = new FormData(e.currentTarget),
                    start = String(fields.get("start")),
                    end = String(fields.get("end"));
                  if (start > end || end > today) {
                    setRangeError(
                      "Choose a start before the end, through today at the latest.",
                    );
                    return;
                  }
                  setRangeError("");
                  setCustom({ start, end });
                }}
              >
                <label>
                  From
                  <input
                    name="start"
                    type="date"
                    defaultValue={custom.start}
                    required
                    max={today}
                  />
                </label>
                <label>
                  Through
                  <input
                    name="end"
                    type="date"
                    defaultValue={custom.end}
                    required
                    max={today}
                  />
                </label>
                <button className="button" type="submit">
                  Apply range
                </button>
                {rangeError && (
                  <p className="form-error" role="alert">
                    {rangeError}
                  </p>
                )}
              </form>
            )}

          {age >= 48 && (
            <div className="status-banner" role="status">
              Your snapshot is more than two days old. Recent workouts may be
              missing.{" "}
              <button className="text-button" onClick={() => setSettings(true)}>
                Check sync status
              </button>
            </div>
          )}

          <Suspense
            fallback={
              <div className="view-loading" role="status">
                Opening your view…
              </div>
            }
          >
            {view === "overview" && (
              <Overview
                dataset={dataset}
                context={context}
                onWorkout={setSelectedWorkout}
                onExplore={explore}
              />
            )}

            {view === "explore" && (
              <Explore
                dataset={dataset}
                context={context}
                selection={selection}
                onSelect={setSelection}
                onWorkout={setSelectedWorkout}
              />
            )}

            {view === "lab" && (
              <Lab
                dataset={dataset}
                timezone={timezone}
                now={context.now}
                draft={draft}
                onDraft={setDraft}
                onWorkout={setSelectedWorkout}
              />
            )}

            {view === "journey" && (
              <JourneyView
                dataset={dataset}
                context={context}
                onWorkout={setSelectedWorkout}
              />
            )}
          </Suspense>

          <footer className="app-footer">
            <Wordmark />
            <span>Built from the work you put in.</span>
            <span>Hevy · Private by design</span>
          </footer>
        </main>
      </div>

      {workout && (
        <WorkoutDetail
          workout={workout}
          dataset={dataset}
          context={context}
          onClose={() => setSelectedWorkout(null)}
        />
      )}
    </div>
  );
}
