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
| Remediate with a trigger | `scripts/remediate.sh` (manual curl to the flag trigger) | Flag flips off in LaunchDarkly, UI rolls back, History tab shows the trigger event. |
| Remediate automatically | `client/src/components/PanelErrorBoundary.tsx` (`trackInsightsCrash`), `server/src/routes/demo.ts` (injects the bad data; simulates visitors), a **guarded rollout** on the flag in LaunchDarkly | The crash is recorded in Observability (session replay) and as the `insights-dashboard-crash` metric; LaunchDarkly rolls the flag back when the new variation regresses. |

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
4. With the flag running as a **guarded rollout**, click **Inject bad report data** under Demo
   controls and **Simulate 300 visitors** under Guarded rollout: "A bad upstream deploy just
   shipped. Everyone on the new dashboard is crashing; the usage table is fine. LaunchDarkly is
   comparing the two." Within a minute or two the flag turns off by itself: "No pager, no webhook -
   LaunchDarkly saw the regression and rolled back." Show `npm run remediate` as the manual
   equivalent an on-call engineer would use to skip the wait.
5. Open the flag's **Monitoring → Logs**: "Here is the whole incident as LaunchDarkly saw it, browser
   and API side by side: release, bad data, crash, rollback." Then **History**: "Every change is
   attributed and auditable - this one to the guarded rollout."

## Guarded rollout (LaunchDarkly remediates by itself)

The app contains no code that turns the flag off. The error boundary sends an
`insights-dashboard-crash` metric event, the **Guarded rollout** card can send it for hundreds of
synthetic visitors (`POST /api/demo/simulate-reports`), and a guarded rollout on the flag compares
the crash rate of the new dashboard with the usage table and turns the flag off on its own when it
regresses. Demo: simulate with bad data off (healthy), inject bad data, simulate again (100% crash
rate on `true`), watch LaunchDarkly roll back. Setup is in the README under *Remediate with a
guarded rollout*. The flag trigger stays as the manual, instant path (`npm run remediate`).

## Design decisions worth calling out

- **Fail closed.** Every evaluation passes `false` as the default, so an outage of LaunchDarkly or
  a misconfigured key degrades to the known-good usage table.
- **Both SDK sides.** The browser uses the client-side ID (public, flag-scoped); the API uses the
  SDK key (secret, full environment). Showing both demonstrates the right key goes in the right
  place.
- **Singleton server client.** `server/src/ld.ts` creates one `LDClient` for the process and shuts
  it down cleanly (`flush` then `close`) on SIGINT/SIGTERM.
- **Error boundary + metric, not error boundary + webhook.** The boundary reports the crash to
  LaunchDarkly as a metric and lets the guarded rollout decide; the app never hard-codes "a crash
  means roll back". The trigger URL stays for humans and monitoring tools.
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
- [ ] LaunchDarkly flag History tab showing the guarded rollout's automatic rollback (and a trigger entry from `npm run remediate`)
