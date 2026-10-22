# Part 1 — Release and Remediate: walkthrough for reviewers

**Scenario.** ABC Company must ship faster without lowering quality. The team needs to test new
code in production safely, release it with confidence, and roll it back in seconds if a bug slips
through. This app shows that workflow with a new **Insights** reporting dashboard: a plain monthly
usage table today, KPI tiles, trend charts and a team breakdown behind the flag.

## What to look for

| Requirement | Where it lives | What you'll see |
| --- | --- | --- |
| Flag around a new feature | `client/src/components/FeatureGate.tsx` (`useBoolVariation`) and `server/src/routes/reports.ts` (`boolVariation`) | Flag on → Insights dashboard + new API payload. Flag off → usage table + legacy payload. |
| Listener / instant switch | `client/src/components/FlagActivityLog.tsx` (`client.on('change:insights-dashboard')`), `server/src/routes/flagEvents.ts` (`ldClient.on('update:insights-dashboard')` → SSE) | Toggle in LaunchDarkly; both log cards in the Admin drawer print a timestamped line and the panel swaps with no reload. |
| Remediate with a trigger | `scripts/remediate.sh` (manual curl), `server/src/routes/remediate.ts` (automatic on crash), `server/src/routes/demo.ts` (injects the bad data) | Flag flips off in LaunchDarkly, UI rolls back, History tab shows the trigger event, Observability → Errors shows the crash with a session replay. |

## Layout

The page is split into what a customer sees and what an operator sees. The customer view is the
whole page. Everything operational - LaunchDarkly connection status, release steps, demo controls,
and the client/server flag logs - lives in the **Admin** drawer (top right), which slides over the
page without disturbing it. The **part picker** next to it selects the exercise part; each part
registers its own end-user view and admin panel in `client/src/scenarios/index.ts`.

## Suggested 3-minute demo

Open the Admin drawer first so the audience can watch the logs.

1. Start with the flag **off**: "This is what every customer sees today."
2. Turn it **on**: "That's a production release. No deploy. Every connected browser got it in under
   a second — and the API switched too, so the data matches the UI."
3. Turn it **off**: "And that's the rollback. Same speed, same blast radius: zero."
4. Turn it **on**, click **Inject bad report data** under Demo controls, wait for the dashboard's
   10-second refresh: "A bad upstream deploy just shipped. The dashboard pulled the broken payload and
   crashed. The error boundary contained it, LaunchDarkly Observability recorded it with a session
   replay, the app reported it, and the trigger turned the feature off for everyone before a human
   picked up the pager." Then show `npm run remediate` as the manual equivalent an
   on-call engineer or a monitoring tool would use.
5. Open the flag's **Monitoring → Logs**: "Here is the whole incident as LaunchDarkly saw it, browser
   and API side by side: release, bad data, crash, kill switch, rollback." Then **History**: "Every
   change is attributed and auditable."

## Guarded rollout (optional talking point)

The trigger path is our code deciding "a crash means roll back". The alternative is to let
LaunchDarkly decide: the error boundary also sends an `insights-dashboard-crash` metric event, the
**Guarded rollout** card can send it for hundreds of synthetic visitors
(`POST /api/demo/simulate-reports`), and a guarded rollout on the flag compares the crash rate of
the new dashboard with the usage table and turns the flag off on its own when it regresses. It
needs traffic in both arms and a few minutes to decide, so the live demo uses the trigger and
describes this one. Setup is in the README under *Going further: guarded rollout*.

## Design decisions worth calling out

- **Fail closed.** Every evaluation passes `false` as the default, so an outage of LaunchDarkly or
  a misconfigured key degrades to the known-good usage table.
- **Both SDK sides.** The browser uses the client-side ID (public, flag-scoped); the API uses the
  SDK key (secret, full environment). Showing both demonstrates the right key goes in the right
  place.
- **Singleton server client.** `server/src/ld.ts` creates one `LDClient` for the process and shuts
  it down cleanly (`flush` then `close`) on SIGINT/SIGTERM.
- **Error boundary + trigger** turns "we can roll back fast" into "we can roll back automatically".
  The same trigger URL works from curl, an APM alert, or application code. The boundary also sends
  the crash as a metric, so a guarded rollout could make the same call statistically.
- **The bug is real data handling, not a planted throw.** Chaos mode makes the API return
  `series: null`; the v2 dashboard assumes the series is always there. Rolling the flag back also
  retires the bad data, so re-releasing renders healthy.
- **Observability closes the loop.** The same client-side ID feeds errors and session replays into
  LaunchDarkly, so the audience sees the crash *in LaunchDarkly* before seeing LaunchDarkly kill it.
- **REST fallback.** `scripts/remediate-api.sh` uses a semantic patch (`turnFlagOff`) for accounts
  without flag triggers, so the remediation story works on any plan.

## Screenshots

_Add screenshots here before submitting:_

- [ ] Flag off — usage table with the Admin drawer open, both listener logs showing `false`
- [ ] Flag on — Insights dashboard, logs showing `true`, server listener "new"
- [ ] Crash card after "Inject bad report data"
- [ ] LaunchDarkly Observability → Errors showing the recorded error and its session replay
- [ ] Flag → Monitoring → Logs showing the incident timeline from both tiers
- [ ] Terminal output of `npm run remediate` (HTTP 200)
- [ ] LaunchDarkly flag History tab showing the trigger entry
