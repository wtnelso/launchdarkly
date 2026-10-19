# Extra credit — Experimentation: walkthrough for reviewers

**Scenario.** Part 2 shipped the new landing-page hero to named people and segments. Before
ABC Company rolls it out to all 40,000 daily visitors, marketing wants proof that it actually
performs better. So the same `landing-hero-v-2` flag now runs an **A/B experiment** on its
default rule: visitors who are not individually targeted are split 50/50, and LaunchDarkly measures
how many of each group click the hero's primary call to action.

Select **Part 3 · Experiment** in the top-right picker. The end-user view is the Part 2 landing
page, unchanged; the Admin drawer is new.

## What to look for

| Requirement | Where it lives | What you'll see |
| --- | --- | --- |
| Same flag as the targeting example | `client/src/scenarios/index.ts` (Part 3 reuses `Part2View`) | The hero is still gated by `useBoolVariation('landing-hero-v-2')`; the experiment lives on that flag's default rule, under the Part 2 targets and rules. |
| A metric | `client/src/ld/metrics.ts` → `trackHeroCtaClick()`; wired in `Part2View.tsx` (`useHeroCta`) | Clicking either hero's primary button calls `client.track('hero-cta-click', …)` (conversion) and `client.track('hero-cta-time-to-click', …, ms)` (numeric). The button acknowledges the click; nothing else on the page changes. |
| An experiment | LaunchDarkly → flag → **Experimentation** | 50/50 on the default rule, metric *Hero CTA click*, randomization unit *user*. |
| Enough data to read results | Admin drawer → **Simulate traffic** (`client/src/scenarios/part3/simulateTraffic.ts`) and **Bulk via API** (`server/src/routes/demo.ts`) | Synthetic visitors with random keys: `identify()` → evaluation (the exposure) → a conversion with a different probability per variation. A few hundred visitors are enough for a clear *probability to beat control*. |

## Suggested 3-minute demo

1. **Set the scene.** Admin drawer open, LaunchDarkly experiment **Results** tab open beside it.
   "Alice, Bruno and Carla are still served by their targets and rules - they're not in the
   experiment. Everyone else is a coin flip."
2. **One real conversion.** As the Anonymous visitor, click **Start free trial** (or the v2 CTA if
   you were bucketed into v2). The drawer logs the `hero-cta-click` event with the context key;
   the network tab shows it going to `events.launchdarkly.com`.
3. **Simulate traffic.** Click **Simulate 200 visitors**. Watch the hero flicker as each synthetic
   visitor is identified, the progress bar fill, and the per-variation exposures and conversions
   count up (about 20% vs 32% by default). Then **Bulk: 500 via API** for the same thing from the
   Node SDK in under a second.
4. **Read the results.** Reload the experiment's Results tab after a couple of minutes: exposures
   per variation, conversion rate, probability to beat control, and the credible interval for the
   relative difference. "Hero v2 beats classic with ~99% probability. Now we can ship it to
   everyone with confidence - and if it had lost, we'd have learned that from 1% of traffic, not
   100%."
5. **Ship the winner.** In LaunchDarkly, stop the experiment and set the default rule to serve
   `true`: the classic hero disappears for every visitor, instantly, no deploy.

## Design decisions worth calling out

- **The exposure is the evaluation, not a separate event.** `useBoolVariation` in `HeroGate` is
  what renders the hero, and the SDK's feature event for that evaluation is what LaunchDarkly
  counts as the exposure. The metric event only has to be sent for the same context; attribution
  is LaunchDarkly's job. Nothing in the app knows which variation is "control".
- **Conversion + numeric.** A binary conversion answers "did v2 get more clicks?"; the numeric
  time-to-click metric shows the `metricValue` argument of `track()` and gives the experiment a
  secondary metric to discuss (lower is better).
- **Synthetic visitors deliberately miss the Part 2 rules** (no beta testers, no enterprise plans)
  so every one of them reaches the default rule and the experiment. They are tagged
  `synthetic: true` so they can be filtered in **Contexts**.
- **Two tiers again.** The browser simulator is the honest one (one `identify()` per visitor, same
  code path as a real page view, ~5 visitors/s). The API simulator exists because the Node SDK
  evaluates locally and can produce thousands of exposures in a second - useful when a reviewer
  wants significance *now*.
- **Nothing is sent until the experiment exists.** Before the experiment starts, LaunchDarkly only
  asks the SDKs for *summary* events, so a simulation run shows up as traffic but not as experiment
  data. Once the experiment is running the flag's default rule carries `trackEvents`, the SDKs send
  one feature event per exposure, and results start to accumulate.

## Screenshots

_Add before submitting:_

- [ ] Admin drawer, Part 3: a real conversion in **Your own clicks** and a finished simulation run
- [ ] LaunchDarkly → Metrics → *Hero CTA click* (event key `hero-cta-click`)
- [ ] LaunchDarkly → flag → Experimentation: the running experiment, 50/50 on the default rule
- [ ] Experiment Results tab with exposures, conversion rates and probability to beat control
