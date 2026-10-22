# ABC Company Analytics — LaunchDarkly technical exercise

A React + Node app that demonstrates LaunchDarkly feature flags end to end: release and roll back a
feature with no deploy, remediate a bad release automatically, target visitors by context
attributes, run an experiment, and manage an AI chatbot's prompt and model from an AI Config.

| Part | What it shows | LaunchDarkly object | Walkthrough |
| --- | --- | --- | --- |
| 1 · Release & Remediate | New **Insights** dashboard behind a flag; instant release/rollback on both client and server; a flag **trigger** as the kill switch (manual via `curl`, automatic on crash) | flag `insights-dashboard`, trigger | [docs/part1-release-and-remediate.md](docs/part1-release-and-remediate.md) |
| 2 · Target | Landing-page hero served per visitor: individual target, rules on user and organization attributes | flag `landing-hero-v-2` | [docs/part2-targeting.md](docs/part2-targeting.md) |
| 3 · Experiment (extra credit) | A/B test on the same flag; conversion metric from `client.track()`; traffic simulator | metric `hero-cta-click`, experiment | [docs/part3-experimentation.md](docs/part3-experimentation.md) |
| 4 · AI Config (extra credit) | Support chatbot whose model and prompt live in LaunchDarkly; feedback, latency and token metrics; optional experiment on prompt variants | AI Config `support-assistant` | [docs/part4-ai-configs.md](docs/part4-ai-configs.md) |

## Assumptions

- macOS or Linux shell with `bash` and `curl` (Windows: WSL or Git Bash).
- **Node.js 20+** and **npm 10+** (`node -v`, `npm -v`). Built and tested with Node 22.
- Ports **5173** (web) and **3001** (API) are free.
- A **LaunchDarkly account**. A free trial is enough; it includes flag triggers, Experimentation
  and AI Configs. Use **one environment** for everything below (the steps assume `Test`).
- No LLM API key is needed: Part 4 answers with a local stand-in that honours the AI Config's model
  name and prompt (see [How it works](#how-it-works)).

## Setup

### 1. Install and create the env files

```bash
npm install
cp client/.env.example client/.env
cp server/.env.example server/.env
```

### 2. Copy the LaunchDarkly keys

In LaunchDarkly: **Organization settings → Projects → your project → Environments**. For the
environment you'll use, copy:

| Value | Looks like | Goes in | Used by |
| --- | --- | --- | --- |
| **SDK key** | `sdk-…` (secret) | `server/.env` → `LD_SDK_KEY` | Node server SDK (`server/src/ld.ts`) |
| **Client-side ID** | long hex string | `client/.env` → `VITE_LD_CLIENT_SIDE_ID` | React SDK + Observability (`client/src/ld/provider.ts`) |
| **Trigger URL** (step 3b) | `https://app.launchdarkly.com/webhook/triggers/…` | `server/.env` → `LD_TRIGGER_URL` | `npm run remediate` and the automatic kill switch |

Optional: `LD_ENVIRONMENT_ID` (same value as the client-side ID) lets server-side logs carry the
environment id. The `.env` files are git-ignored.

### 3. Create the LaunchDarkly objects

Keys must match the code exactly (see the [REPLACE ME index](#replace-me-index) if you change them).

| Object | Key | Settings | Part |
| --- | --- | --- | --- |
| Boolean flag | `insights-dashboard` | **Available on client-side SDKs** on; off variation `false` | 1 |
| Flag trigger | on `insights-dashboard` | Generic trigger, action **Turn flag off** | 1 |
| Boolean flag | `landing-hero-v-2` | client-side on; individual target + 2 rules (3c) | 2, 3 |
| Metric | `hero-cta-click` | Custom event, **Occurrence (Percent)**, unit user, higher is better | 3 |
| Experiment | on `landing-hero-v-2` | default rule, 50/50, control `false`, primary metric above | 3 |
| AI Config | `support-assistant` | two variations (3e); default rule → Concise | 4 |
| Metric (optional) | `hero-cta-time-to-click` | Custom, numeric Average, lower is better | 3 |
| Metric (optional) | `insights-dashboard-crash` | Custom, Occurrence (Percent), lower is better; for a guarded rollout | 1 |

**3a. Flag `insights-dashboard`.** Flags → Create flag → name `Insights dashboard` (key auto-fills)
→ Boolean → make sure **Available on client-side SDKs** is on → Create. Leave it off.

**3b. Trigger.** On the flag, ⋯ next to the environment → **Configuration in environment** →
Triggers → **+ Add trigger** → Generic trigger, **Turn flag off** → Save. Copy the URL (shown once)
into `server/.env`. No Triggers section on your plan? Use `npm run remediate:api` instead, which
needs `LD_API_TOKEN` (Organization settings → Authorization, Writer role) in `server/.env`.

**3c. Flag `landing-hero-v-2`.** Create it like 3a (name `Landing hero v2`). Run the app, pick
**Part 2**, open the Admin drawer and click through all four personas once so LaunchDarkly learns
the attributes. Then on the Targeting tab:
- Individual targets → user `alice-chen` → `true`
- Rule *Beta testers*: user · `betaTester` · is one of · `true` → `true`
- Rule *Enterprise organizations*: organization · `plan` · is one of · `enterprise` → `true`
- Default rule `false`; flag On; Review and save.

Or apply the same with the REST API: `npm run setup:part2` (needs `LD_API_TOKEN`).

**3d. Metric and experiment (Part 3).** Metrics → Create metric → LaunchDarkly hosted, event kind
Custom, event key `hero-cta-click`, definition **Occurrence (Percent)**, name `Hero CTA click`,
unit user, higher is better. Then Experimentation → Experiments → Create experiment → name
`Landing hero v2 vs classic` → Design: assignment *LaunchDarkly flag or config* → `Landing hero v2`
→ randomize by **user** → default rule, audience 100 %, control `false`, split equally → Metrics:
`Hero CTA click` as primary → Save → **Start**.

**3e. AI Config (Part 4).** Agents → Configs → Create config → name `Support assistant`, **Edit key**
→ `support-assistant` → Create. On Variations add two (the app reads the model name for latency and
`max_tokens` for reply length, so any model works; a custom model is fine):

| Variation | Model | Parameters | System prompt / Agent task |
| --- | --- | --- | --- |
| `Concise (fast model)` | a small model (name containing `mini`, `haiku`, `flash`, `nano`, `small` or `lite`, e.g. custom `abc-support-small`) | `temperature 0.2`, `max_tokens 120` | `You are the {{product}} support assistant for {{company}}. The customer is {{customerName}} on the {{plan}} plan. Be concise: answer in at most two short sentences, no greetings, no emoji. If the question is about billing, say an account manager will follow up.` |
| `Friendly & thorough` | a large model (e.g. custom `abc-support-large`) | `temperature 0.7`, `max_tokens 400` | `You are the {{product}} support assistant for {{company}}. Greet {{customerName}} by name, be warm and thorough: explain the why, give numbered steps, and mention one relevant {{plan}}-plan tip. End by asking if that solved it.` |

Review and save. On Targeting set the default rule to **Concise (fast model)**; optionally add a
rule organization · `plan` · is one of · `enterprise` → **Friendly & thorough**. Both *Completion*
and *Agent* config types work; for an Agent config the prompt goes in the *Agent task* field.
For the optional experiment on the config: chat once and click 👍 so the AI metrics exist, then
Create experiment → config `support-assistant` → default rule → randomize by user → control
Concise → primary metric **Positive AI feedback rate** → Start.

### REPLACE ME index

Every value tied to your LaunchDarkly account is marked `REPLACE ME` in the code:

| File | What |
| --- | --- |
| `server/.env.example` | `LD_SDK_KEY` (server SDK key), `LD_TRIGGER_URL`, optional `LD_API_TOKEN`, `LD_PROJECT_KEY`, `LD_ENV_KEY` |
| `client/.env.example` | `VITE_LD_CLIENT_SIDE_ID` (client-side ID, not the SDK key) |
| `server/src/ld.ts` | reads the SDK key; `FLAG_KEYS` (`insights-dashboard`, `landing-hero-v-2`, `support-assistant`); `METRIC_EVENTS` |
| `client/src/ld/flags.ts` | the same flag keys for the browser |
| `client/src/ld/metrics.ts` | metric event keys (`hero-cta-click`, `hero-cta-time-to-click`, `insights-dashboard-crash`) |
| `client/src/ld/provider.ts` | reads the client-side ID; SDK options (streaming, reasons, observability plugins) |
| `client/src/scenarios/part2/personas.ts` | persona keys and attributes that the Part 2 targeting rules match on |
| `server/src/routes/remediate.ts` | reads the trigger URL for the automatic kill switch |

## Run

```bash
npm run dev
```

Starts the API on <http://localhost:3001> and the web app on <http://localhost:5173>. Open the web
app. Top right: the **☰** button opens the Admin drawer (LaunchDarkly connection status, the
**Exercise part** picker, demo controls and flag logs). The chosen part is kept in the URL hash
(`#part-1` … `#part-4`). The drawer header should read **connected**.

| Command | What it does |
| --- | --- |
| `npm run dev` | API (`tsx watch`) + web app (Vite) with hot reload |
| `npm run build` / `npm run typecheck` | Compile / type-check both workspaces |
| `npm run remediate` | Fire the flag trigger (turn `insights-dashboard` off) |
| `npm run remediate:api` | Same via the REST API (needs `LD_API_TOKEN`) |
| `npm run setup:part2` | Apply the Part 2 targeting via the REST API |

## Walkthroughs

**Part 1 · Release & Remediate** (put the LaunchDarkly flag page next to the app; never reload)
1. Flip `insights-dashboard` **On**: the usage table becomes the Insights dashboard in under a second.
   The drawer's *Client listener* and *Server listener* both log the change.
2. Flip it **Off**: instant rollback.
3. On again, then `npm run remediate`: the trigger turns the flag off; the app rolls back.
4. On again, then Admin → **Inject bad report data**: the API returns a malformed payload, the
   dashboard crashes, the error boundary records it in Observability (with session replay) and
   reports it to the API, which fires the trigger. The flag turns off by itself.
5. The flag's **History** attributes every change; **Monitoring → Errors / Logs** show the incident.
   The optional **Guarded rollout** card shows how LaunchDarkly could make that call statistically.

**Part 2 · Target**
1. Admin → pick a persona. The *Context payload* card shows the exact multi-context `identify()` sends.
2. Anonymous → classic hero (*Default rule*). Alice → v2 (*Individual target*). Bruno → v2 with the
   beta badge (*Rule 1*, a user attribute). Carla → v2 enterprise copy (*Rule 2*, an organization
   attribute).
3. Edit a rule in LaunchDarkly: the affected persona changes instantly, the others don't.

**Part 3 · Experiment** (start the experiment first; before that the SDK only sends summary events)
1. As the anonymous visitor click the hero's primary button: a `hero-cta-click` event is sent.
2. Admin → **Simulate 200 visitors** (browser: `identify()` per visitor) or **Bulk: 500 via API**.
   Hero v2 converts at ~32 % vs ~20 % by default.
3. Experiments → Results: exposures, conversion rate per variation, probability to beat control.

**Part 4 · AI Config**
1. Chat as the anonymous visitor: a two-sentence reply in ~300 ms from the Concise variation. The
   drawer shows the variation, model, version, reason and rendered prompt. Click 👍.
2. Switch to Carla: the Friendly variation on the large model.
3. Edit a variation's prompt in LaunchDarkly, save, ask again: the style changes with no deploy.
   Toggle the config off: the assistant goes offline with a banner.
4. **Simulate 300 conversations**, then the config's **Monitoring** tab (Generations, Satisfaction,
   Time to generate, Tokens) and the experiment's Results.

## How it works

- **Flags and listeners.** The browser evaluates with `useBoolVariation` (React SDK, client-side
  ID); the API with `ldClient.boolVariation` (Node SDK, SDK key). Both hold a streaming connection,
  so a change in LaunchDarkly re-renders the page and updates the API's responses without polling
  or reload. `client.on('change:…')` and `ldClient.on('update:…')` (pushed to the browser over SSE)
  make the listener visible. Every evaluation passes `false` as the default, so the app fails
  closed to the old behaviour if LaunchDarkly is unreachable.
- **Remediation.** A flag trigger is a webhook URL bound to one action on one flag. `scripts/remediate.sh`
  POSTs it with curl; `server/src/routes/remediate.ts` POSTs it when the error boundary reports a
  crash. The optional guarded rollout uses the `insights-dashboard-crash` metric instead
  (`client/src/ld/metrics.ts`; the Admin card simulates traffic so it has data).
- **Targeting.** Personas are multi-contexts (`user` + `organization`). `identify()` sends the
  context; LaunchDarkly evaluates targets, then rules, then the default rule, and returns the value
  and reason (`withReasons: true`). Part 2 needs no server.
- **Experimentation.** The exposure is the flag evaluation; conversions are `client.track('hero-cta-click')`.
  Simulators give each synthetic visitor a fresh user key so LaunchDarkly buckets them
  independently; the API one also uses `ldClient.track()` server-side.
- **AI Config.** `server/src/ai/supportAssistant.ts` fetches `support-assistant` per visitor with
  `@launchdarkly/server-sdk-ai` (variables `customerName`, `plan`, `company`, `product`), runs the
  local responder, and records duration, tokens and success on the SDK tracker; thumbs up/down are
  attached later through the tracker's resumption token. Those `$ld:ai:*` events feed the config's
  Monitoring tab and the autogenerated AI metrics. The responder (`localResponder.ts`) keys reply
  style on the prompt text and latency on the model name, so changes in LaunchDarkly are visible.
- **Observability.** The browser loads the `@launchdarkly/observability` and `session-replay`
  plugins (client-side ID); the API loads `@launchdarkly/observability-node` (SDK key). Logs and
  errors that should appear under a flag's Monitoring tab are written inside spans that carry the
  `feature_flag.*` attributes (`client/src/ld/telemetry.ts`, `logFlagEvent` in `server/src/ld.ts`).

## Project layout

```
client/src/
  App.tsx                 top bar, hamburger → Admin drawer, part picker
  ld/                     provider.ts (SDK setup), flags.ts, metrics.ts, telemetry.ts
  components/             FeatureGate, InsightsDashboard, UsageReportTable, PanelErrorBoundary,
                          FlagActivityLog, ServerStatus, AdminDrawer, SiteNav
  scenarios/              one folder per part: { View, Admin } registered in index.ts
server/src/
  ld.ts                   Node SDK singleton, FLAG_KEYS, METRIC_EVENTS, logFlagEvent()
  ai/                     supportAssistant.ts (AI SDK + tracker), localResponder.ts
  routes/                 reports.ts, flagEvents.ts (SSE), remediate.ts, demo.ts (chaos + simulators), chat.ts
scripts/                  remediate.sh, remediate-api.sh, setup-part2-targeting.sh
docs/                     reviewer walkthroughs for each part
```

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Banner: `VITE_LD_CLIENT_SIDE_ID is not set` / header `failed` | Create `client/.env` with the **client-side ID** (no `sdk-` prefix); restart `npm run dev`. |
| Server exits: `LD_SDK_KEY is not set` | Create `server/.env` with the `sdk-…` key. |
| Flag changes show in the server log but not the browser | The flag isn't **Available on client-side SDKs** (flag → Advanced controls). |
| Evaluation card: `FLAG_NOT_FOUND` | The flag doesn't exist yet or its key differs from `flags.ts` / `ld.ts`. |
| Rule builder doesn't list `plan` / `betaTester` | Click through the Part 2 personas first; LaunchDarkly learns attributes from SDK traffic. |
| `npm run remediate` → not set / 401 / 404 | Create the trigger (3b) or reset its URL; or use `npm run remediate:api`. |
| Experiment Results stay empty | The experiment wasn't started when traffic ran, or the metric key ≠ `hero-cta-click`. Start it, simulate again, wait a few minutes. |
| Part 4 pill says **Fallback** | `support-assistant` doesn't exist, has a different key, or the server SDK is offline; the in-code default answers. |
| Part 4 shows the "taking a break" banner | The config is toggled off in this environment (the kill switch). |
| AI metrics missing in the experiment builder | They're created after the first `$ld:ai:*` events arrive: chat once and click 👍, then reopen. |
| Flag Monitoring → Logs is empty | Only spans with `feature_flag.*` attributes show there; widen the time range. |
| Port in use | Change `API_PORT` in `server/.env` and the proxy target in `client/vite.config.ts`. |
