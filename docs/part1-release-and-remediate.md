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
5. Open the flag's **History**: "Every change is attributed and auditable."

## Design decisions worth calling out

- **Fail closed.** Every evaluation passes `false` as the default, so an outage of LaunchDarkly or
  a misconfigured key degrades to the known-good usage table.
- **Both SDK sides.** The browser uses the client-side ID (public, flag-scoped); the API uses the
  SDK key (secret, full environment). Showing both demonstrates the right key goes in the right
  place.
- **Singleton server client.** `server/src/ld.ts` creates one `LDClient` for the process and shuts
  it down cleanly (`flush` then `close`) on SIGINT/SIGTERM.
- **Error boundary + trigger** turns "we can roll back fast" into "we can roll back automatically".
  The same trigger URL works from curl, an APM alert, or application code.
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
- [ ] Terminal output of `npm run remediate` (HTTP 200)
- [ ] LaunchDarkly flag History tab showing the trigger entry
