# Analytics and data rules

These rules describe the implemented dashboard. Results are deterministic calculations over the accepted Hevy snapshot. The app does not call an AI model, infer missing health data, or generate training prescriptions.

## Time, scope, and comparisons

- **Overview and Explore:** the default window is 28 calendar days ending today, inclusive. Other choices are 12 weeks, 26 weeks, all history, or custom inclusive dates. A workout belongs to the date of its start time in the selected calendar timezone.
- **Comparison:** the immediately preceding interval has the same number of calendar days and does not overlap the selected interval. All-history mode disables this comparison. The comparison is descriptive; unequal activity or exercise selection can explain a difference.
- **Calendar:** weeks start Monday. Day arithmetic uses calendar dates rather than elapsed 24-hour blocks, preserving leap-day and daylight-saving boundaries. Weekly charts retain zero-session weeks and mark weeks clipped by the selected range.
- **Timezone:** the initial setting is the browser timezone. Changing it can move a session to another day or week. Date-only body measurements keep their recorded date; measurements with timestamps use the selected timezone.
- **Journey:** achievements use all recorded history; consistency uses the selected timezone and the current week. Boss Battle uses the current calendar month. The Overview/Explore range and warmup toggle do not scope Journey.
- **Scenario lab:** its baseline is one completed Monday–Sunday week containing workouts. Available weeks are listed most recent first. A draft belongs to both its source content fingerprint and timezone.

Percent change is `(current - previous) / previous × 100` only when the previous value is positive. A zero or absent baseline produces no percentage, rather than Infinity or an invented improvement. Overview comparison percentages also require history reaching the beginning of the comparison interval. Exercise median comparisons require at least three nonmissing observations in each interval.

## Sets, loads, and exercise series

| Measure                         | Rule                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions                        | Number of recorded workout objects. Two sessions on one day count as two sessions.                                                                      |
| Working sets                    | Sets whose type is not `warmup`. This includes other recorded types and does not imply a particular effort level.                                       |
| Repetition totals               | Sum of recorded repetitions over included sets. Missing repetitions contribute nothing; original fields remain missing in the session table.            |
| Load volume                     | Sum of `max(0, recorded weightKg) × recorded repetitions` over included sets. Missing values contribute zero to this sum.                               |
| Logged session duration         | Elapsed time between the recorded start and end timestamps, recomputed during validation. It includes pauses and does not measure active exercise time. |
| Exercise top load               | Highest recorded load in an included set for that exercise and session.                                                                                 |
| Exercise top-set reps           | Highest recorded repetition count in an included set.                                                                                                   |
| Exercise recorded time/distance | Highest recorded set duration or distance in that session, not the sum of session activity.                                                             |
| Exercise load volume            | Sum of included set load volume across every occurrence of the exercise in that session.                                                                |
| RPE                             | Median of the available ratings in included sets. Missing ratings are excluded; coverage is shown.                                                      |

Kilograms are the calculation unit. Pounds are a display conversion; changing display units does not recalculate records from rounded numbers. Load volume does not add body weight, double unilateral loads, estimate machine resistance, or normalize assisted/bodyweight exercise conventions. Positive recorded loads still participate in aggregate volume; negative assistance values contribute zero. Exercise type restrictions are stricter for estimated strength and scenario editing, as described below.

The **Warmups** control starts off. Enabling it includes warmups in Overview/Explore session totals, repetitions, volume, and applicable raw exercise metrics. Estimated-strength records always exclude warmups. The muscle matrix and Scenario lab workload always count working sets. Journey trophy and mountain volume include all logged sets, including warmups.

A missing per-session metric is `null` and displayed as unrecorded. Charts leave a gap at that observation. Metric options depend on fields actually present in history; unknown exercise metadata cannot qualify a set for estimated strength.

The training atlas uses an independent vertical scale for each exercise. Its relative mode sets that exercise's first positive eligible value within the selected range to 100; it does not make different lifts directly comparable. Atlas percentage labels compare first and last eligible observations, while the Explore comparison uses period medians. Lines retain all observations. Longer histories limit interactive markers to sampled sessions plus endpoints and extremes; the paginated tables retain every observation.

## Estimated strength and personal records

An estimated 1RM is eligible only when the exercise template type is exactly `weight_reps`, the set is not a warmup, the load is finite and positive, and repetitions are an integer from 1 through 10.

```text
1 repetition:    estimated 1RM = recorded load
2–10 repetitions: estimated 1RM = recorded load × (1 + repetitions / 30)
```

This is an estimate from the recorded set, not a measured maximum. Assisted movements, unknown template types, zero or negative loads, missing values, and sets above ten repetitions do not qualify.

Record calculation processes sessions chronologically. It combines repeated occurrences of the same template within a session and selects that session's highest eligible estimate. The first eligible observation establishes a baseline. A later session is an improvement only when its best estimate exceeds the earlier all-time best by more than `1e-9`; tied values and display rounding cannot create a record. A session can contribute at most one improvement per exercise, and can contribute improvements for several exercises.

The same record events drive Explore markers, record totals, the trophy wall, Journey record entries, and Boss Battle PR highlights. A later record does not erase earlier improvements when the visible range changes. The heaviest recorded working set and the best eligible estimated 1RM are different measures and can come from different sets.

Automatic findings are limited to supported observations: verified records, changes in period medians with enough samples, session-count differences, and recorded workload. Their sample counts and source sessions provide context. These findings do not establish causation or diagnose a plateau.

## Muscle distribution and routine comparisons

Each working set contributes once to its exercise template's primary muscle. Secondary groups are counted separately, deduplicated within a template, and never added to primary totals. Missing primary-muscle metadata is excluded from the matrix and reflected in its classified/total count. The Scenario lab instead shows missing primary metadata under `unclassified` so its set totals reconcile.

Matrix cells represent primary-muscle sets in a calendar week. Muscle, week, day, and routine filters select the underlying sessions; they do not recalculate the matrix into a different denominator. Distribution describes logged exercise classification, not muscle growth, recovery, or an optimal balance.

Routine history groups sessions by Hevy routine ID. If no ID exists, sessions group only when their ordered template IDs match. The session comparison initially selects an earlier session from the same group, but another session can be chosen explicitly. Exercises match by template ID and occurrence number, preserving repeated exercise slots. Added and removed exercises are identified, and sets, repetitions, top loads, and volume remain separate measures.

## Scenario calculations

A draft copies actual sessions and their sets. Sessions may be moved within the hypothetical week, repeated, removed, or restored from the source week. Moving a session changes its displayed day, not the original source timestamps or workload totals.

Only working sets from known `weight_reps` templates are editable, and only when recorded load and repetitions are present with no duration/distance value. Loads must remain finite and nonnegative; edited repetitions must be positive integers. Copying a set duplicates its recorded values and reindexes the exercise's sets. Set operations preserve warmups, assisted/bodyweight entries, duration/distance entries, and unknown template types. Repeating or removing a whole session repeats or removes its complete copy, including those preserved entries.

Session, working-set, repetition, volume, and primary-muscle totals are exact arithmetic from the copied values. Baseline and scenario values, absolute differences, and eligible percentages are shown together. An empty scenario has zero workload. None of these operations modifies Hevy or the decrypted source dataset.

Drafts remain in memory while navigating between views. Reloading, closing, or locking clears them. A changed source content fingerprint or timezone makes a draft stale and suppresses its results until reset. A refresh with unchanged content does not invalidate the draft.

### Rough time estimate

For every scenario session, the engine finds distinct historical sessions with both the same routine grouping key **and** the identical ordered list of exercise template IDs. At least three such sessions with positive duration and at least one logged set are required. Sharing a routine ID alone is insufficient if the exercise list changed.

```text
historical rate = recorded session duration / all logged sets
scenario session estimate = median historical rate × scenario logged sets
scenario total estimate = sum of eligible scenario session estimates
```

The denominator and multiplier include warmups and other preserved sets. For example, a session with one warmup and one working set at a rate of ten minutes per logged set totals twenty minutes; adding one working set makes the estimate thirty minutes.

The displayed lower and upper bounds use the smallest and largest observed historical rates for each matching group, scaled by the scenario set count and summed. They are an observed rate range, not a confidence or prediction interval. The total and bounds are withheld if any scenario session lacks enough comparable history. Sample counts represent distinct historical workouts, so duplicating a scenario session does not increase the evidence count. An empty scenario has an estimate and bounds of zero.

This estimate cannot know future rest periods, exercise execution, load effects, or interruptions. Changing load or repetitions alone does not change its time estimate. It predicts neither strength nor physiological adaptation.

## Journey rules

The weekly goal counts sessions and can be set to two, three, four, or five. A completed week below the goal breaks the streak, including an empty week. The unfinished current week has a grace period. Changing the goal recalculates historical goal badges and streaks.

Gym Buddy appearance and mood are playful representations of logged activity. Iron Mountain and trophy volume use cumulative logged volume, including warmups. Boss damage is current-month logged volume; PR highlights do not multiply damage. The boss target uses the mean volume of up to four completed calendar weeks preceding the month, including zero-volume weeks, with a first-training-week fallback. The first month is prorated; target volume adds five percent, rounds to the nearest 500, and has a minimum of 2,000. Victory compares unrounded damage against the target.

## Source coverage and privacy

The sync verifies core workout pagination, IDs, and before/after counts. An inconsistent archive is retried once from the beginning and rejected if it remains inconsistent. A valid zero-workout account is different from a failed fetch. Snapshot writes are atomic; a failed sync does not replace the last accepted local snapshot.

Optional sources have explicit statuses: `available`, `empty`, `partial`, `unavailable`, or `unknown`. Template coverage reports resolved versus referenced templates. Legacy snapshots normalize to unknown coverage. Missing names or template metadata do not create invented values. Body measurements marked partial or unavailable are not presented as a complete trend, and missing weight, body fat, or RPE remain missing.

New snapshots carry schema version 2 and a canonical SHA-256 content fingerprint. The fingerprint excludes the sync timestamp so an unchanged resync retains its identity. The browser validates the envelope, decrypts with AES-GCM, validates the dataset, and recomputes content identity. A version-2 fingerprint mismatch is rejected. Invalid counts, duplicate evidence indices, malformed numbers, and unsupported formats fail instead of being silently replaced by zeros.

The build uses PBKDF2-SHA256 with 200,000 iterations and a random 16-byte salt to derive an AES-256-GCM key; each payload has a random 12-byte IV. Only the envelope is published at `data/dataset.enc.json`. Plaintext snapshots stay outside the built site, and decrypted workouts and scenario drafts stay in browser memory. The public ciphertext can still be subjected to offline password guessing; a strong passphrase matters.

Units, weekly goals, and the Buddy name are local preferences. Remembered access stores encrypted password material in localStorage and a non-extractable device key in IndexedDB. It is convenience for a trusted browser profile, not protection against someone already using that unlocked profile.

The artifact check validates the envelope and its allowed fields, rejects plaintext dataset/environment/database/source-map files, and detects recognizable embedded fixture data. This is a targeted deployment check, not a guarantee that arbitrary secrets can be identified. Pull-request CI uses synthetic encrypted data without real account secrets. The deployed app contains no runtime fixture import, AI service, or Hevy API client.
