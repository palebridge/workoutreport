import { useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import type { Dataset } from "../../data/types";
import type { AnalysisContext } from "../../data/calendar";
import { displayDay, localDay } from "../../data/calendar";
import { buddy, bossBattle, ironMountain } from "../../data/game";
import {
  consistency,
  journeyEvents,
  muscleBalance,
  overview,
  prWall,
  trophySummary,
} from "../../data/metrics";
import { recordEvents } from "../../data/records";
import { GymBuddy } from "../GymBuddy";
import { BossBattle } from "../BossBattle";
import { IronMountain } from "../IronMountain";
import { TrophyCase } from "../TrophyCase";
import { TARGET_OPTIONS, useWeeklyTarget } from "../../hooks/useWeeklyTarget";
import { Empty, Methods, number, Panel, useFormat } from "./shared";
import { Icon } from "./Icons";

export default function JourneyView({
  dataset,
  context,
  onWorkout,
}: {
  dataset: Dataset;
  context: AnalysisContext;
  onWorkout: (id: string) => void;
}) {
  const { target, setTarget } = useWeeklyTarget(),
    fmt = useFormat();
  const [shown, setShown] = useState(20);
  const data = useMemo(() => {
    const ov = overview(dataset),
      cons = consistency(dataset, target, context.timezone, context.now);
    const trophy = trophySummary(dataset, ov, cons);
    return {
      ov,
      cons,
      trophy,
      wall: prWall(dataset),
      events: journeyEvents(dataset, target, context.timezone),
      buddy: buddy(
        dataset,
        ov,
        muscleBalance(dataset),
        trophy,
        context.timezone,
        context.now,
      ),
      boss: bossBattle(dataset, context.timezone, context.now),
      mountain: ironMountain(dataset),
      records: recordEvents(dataset).filter((e) => e.previous !== null),
    };
  }, [dataset, target, context.timezone, context.now]);
  return (
    <MotionConfig reducedMotion="user">
      <div className="view-enter journey-view">
        <div className="view-title">
          <p className="eyebrow">Every session leaves a mark</p>
          <h1>A story worth building.</h1>
          <p className="view-intro">
            The milestones, the little victories, and a training partner along
            for the ride.
          </p>
        </div>
        <div className="journey-scope">
          <span className="tag">All history</span>
          <p>
            Achievements use your full log. The boss follows the current
            calendar month. Your selected date range does not change these
            milestones.
          </p>
        </div>
        <Panel
          label="One week at a time"
          title="Keep showing up"
          action={
            <label className="goal-selector">
              Weekly goal
              <select
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              >
                {TARGET_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} sessions
                  </option>
                ))}
              </select>
            </label>
          }
        >
          <div className="journey-stats">
            <div>
              <strong>
                {data.cons.sessionsThisWeek}
                <span>/{target}</span>
              </strong>
              <p>Sessions this week</p>
            </div>
            <div>
              <strong>
                {data.cons.weeksOnTargetStreak}
                <span> weeks</span>
              </strong>
              <p>Current goal streak</p>
            </div>
            <div>
              <strong>
                {data.cons.longestWeekStreak}
                <span> weeks</span>
              </strong>
              <p>Longest goal streak</p>
            </div>
            <div>
              <strong>{number(data.ov.workouts)}</strong>
              <p>Lifetime sessions</p>
            </div>
          </div>
          <p className="chart-note">
            Monday–Sunday in {context.timezone}. The unfinished current week
            gets a grace period. A completed week below your goal breaks the
            streak.
          </p>
        </Panel>
        {dataset.workouts.length ? (
          <>
            <div className="journey-game-grid">
              <GymBuddy state={data.buddy} />
              <BossBattle report={data.boss} onWorkout={onWorkout} />
            </div>
            <IronMountain state={data.mountain} />
            <TrophyCase trophy={data.trophy} wall={data.wall} />
            <div className="journey-lower">
              <Panel
                label="Verified improvements"
                title="A record, and the proof"
              >
                <div className="record-proof-list">
                  {data.records.length ? (
                    [...data.records]
                      .reverse()
                      .slice(0, 8)
                      .map((e) => (
                        <button
                          key={e.workoutId + e.templateId}
                          onClick={() => onWorkout(e.workoutId)}
                        >
                          <span className="record-star">✦</span>
                          <span>
                            <strong>{e.title}</strong>
                            <small>
                              {displayDay(localDay(e.date, context.timezone))} ·{" "}
                              {fmt.weight(e.weightKg)} × {e.reps}
                            </small>
                          </span>
                          <span className="record-proof-value">
                            {fmt.weight(e.value)}
                            <small>estimated 1RM</small>
                          </span>
                          <Icon name="arrow" size={16} />
                        </button>
                      ))
                  ) : (
                    <Empty title="The baseline is set.">
                      A record appears when an eligible set exceeds an earlier
                      estimated-strength best.
                    </Empty>
                  )}
                </div>
              </Panel>
              <Panel
                label="Your training timeline"
                title="The moments that add up"
              >
                <ol className="milestone-list">
                  {data.events.slice(0, shown).map((event, i) => {
                    const workout = dataset.workouts.find(
                      (w) => w.id === event.workoutId,
                    );
                    return (
                      <li key={event.date + event.title + i}>
                        <span className="milestone-mark">{event.emoji}</span>
                        <div>
                          <small>
                            {displayDay(localDay(event.date, context.timezone))}
                          </small>
                          <strong>{event.title}</strong>
                          <p>{event.detail}</p>
                          {workout && (
                            <button
                              className="text-button"
                              onClick={() => onWorkout(workout.id)}
                            >
                              See the session <Icon name="arrow" size={14} />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {shown < data.events.length && (
                  <button
                    className="button full-width"
                    onClick={() => setShown(shown + 20)}
                  >
                    Show 20 more moments
                  </button>
                )}
              </Panel>
            </div>
          </>
        ) : (
          <Empty />
        )}
        <Methods>
          <p>
            Buddy appearance and boss battles are playful representations of
            logged activity. They do not assess your body or training readiness.
            Boss damage is recorded load volume; a PR highlight does not
            multiply it.
          </p>
          <p>
            Records use the same conservative estimated-1RM rules throughout the
            site. Baseline observations are not records, and calculations use
            full precision before display rounding. Trophy volume and mountain
            progress include all logged sets; the weekly goal counts sessions.
          </p>
          <p>
            Changing your weekly goal recalculates goal badges and streaks
            across history. All date grouping uses the calendar timezone shown
            above.
          </p>
        </Methods>
      </div>
    </MotionConfig>
  );
}
