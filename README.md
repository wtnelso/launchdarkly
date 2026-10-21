# ABC Company Analytics — LaunchDarkly Release & Remediate demo

A small React + Node application that shows how ABC Company can **ship features faster without
adding risk** by wrapping new code in a LaunchDarkly feature flag:

| Expectation | How this app demonstrates it |
| --- | --- |
| **Feature flag** around a new feature | The new **Insights** reporting dashboard is gated by the boolean flag `insights-dashboard`. Flag **off** = today's plain monthly usage table; flag **on** = KPI tiles with deltas, 30-day trend charts and a per-team breakdown. |
| **Instant release / rollback** (a "listener", no page reload) | The React SDK's `useBoolVariation` hook and an explicit `client.on('change:insights-dashboard')` listener re-render the page the moment the flag changes. The Node API registers `ldClient.on('update:insights-dashboard')` and pushes the change to the browser over Server-Sent Events, so you can watch both tiers flip together. |
| **Remediate** with a trigger | `npm run remediate` POSTs to a LaunchDarkly **flag trigger** with `curl`, turning the flag off. The Admin drawer can also **inject bad report data**: the API starts returning a malformed payload, the new dashboard crashes on it, the error is recorded in **LaunchDarkly Observability** (with session replay), and the API fires the same trigger automatically (an automatic kill switch). |

This is **Part 1 (Release and Remediate)** of the LaunchDarkly SE technical exercise; [Part 2
(Target)](#part-2-target), the [Experimentation extra credit](#extra-credit-experimentation) and
the [AI Configs extra credit](#extra-credit-ai-configs) build on it. Code paths that depend on *your* LaunchDarkly account are marked with `REPLACE ME`
comments.

---

## Contents

1. [Architecture](#architecture)
2. [Prerequisites and assumptions](#prerequisites-and-assumptions)
3. [LaunchDarkly setup (one time)](#launchdarkly-setup-one-time)
4. [Run the app](#run-the-app)
5. [Demo script: release → rollback → remediate](#demo-script-release--rollback--remediate)
6. [Part 2: Target](#part-2-target)
7. [Extra credit: Experimentation](#extra-credit-experimentation)
8. [Extra credit: AI Configs](#extra-credit-ai-configs)
9. [How it works](#how-it-works)
10. [Project layout](#project-layout)
11. [Troubleshooting](#troubleshooting)

---

## Architecture

```
 Browser (http://localhost:5173)                      LaunchDarkly
 ┌──────────────────────────────────┐   streaming     ┌──────────────────┐
 │ React 19 + Vite                  │◄───────────────►│  flag:           │
 │ @launchdarkly/react-sdk          │  client-side ID │  new-reporting-  │
 │  • useBoolVariation()  (gate)    │                 │  dashboard       │
 │  • client.on('change:…') (log)   │                 │                  │
 └───────────────┬──────────────────┘                 │  flag trigger    │
                 │ /api/* (Vite proxy)                │  (webhook URL)   │
 ┌───────────────▼──────────────────┐   streaming     │        ▲         │
 │ Express 5 (http://localhost:3001)│◄───────────────►│        │         │
 │ @launchdarkly/node-server-sdk    │  SDK key        └────────┼─────────┘
 │  • GET  /api/reports/usage       │                          │ POST
 │  • GET  /api/flag-events (SSE)   │      curl (npm run remediate)
 │  • POST /api/report-error ───────┼──────────────────────────┘
 │  • POST /api/demo/chaos (demo)   │   errors + session replay → LaunchDarkly Observability
 └──────────────────────────────────┘
```

- **Client** evaluates the flag with the LaunchDarkly **client-side ID** (safe in browsers).
- **Server** evaluates the same flag with the **server-side SDK key** (secret) and serves
  flag-dependent report data, so the demo shows the whole stack switching, not just the UI.
- Each tier holds its own streaming connection to LaunchDarkly; neither polls.

## Prerequisites and assumptions

- **macOS or Linux** shell (`bash`, `curl`). Windows users: run inside WSL or Git Bash.
- **Node.js 20 or newer** and **npm 10 or newer** (`node -v`, `npm -v`). Built and tested with
  Node 22.
- A **LaunchDarkly account**. A free trial at <https://launchdarkly.com/start-trial/> is enough.
  The remediation step uses **flag triggers**, which are available on Enterprise plans and
  trials. If your account does not show a *Triggers* section on the flag, use the REST API fallback
  described below; everything else works on any plan.
- Ports **5173** (Vite) and **3001** (API) are free.
- You have cloned this repository and are in its root directory.

## LaunchDarkly setup (one time)

Everything below happens in the LaunchDarkly web app. Names in **bold** are UI labels.

### 1. Pick a project and environment

Use the default project or create one (**Settings** ⚙ → **Projects** → **Create project**),
e.g. key `abc-company`. Every project has at least two environments (`production`, `test`).
Use whichever you like, but **use the same environment for every key below**.

### 2. Create the feature flag

1. **Flags** → **Create flag**.
2. **Name:** `Insights dashboard`. The **key** auto-fills as `insights-dashboard` — **keep this
   exact key** (the code references it in `client/src/ld/flags.ts` and `server/src/ld.ts`; if you
   change it, change it there too).
3. **Description:** `Releases the new Insights reporting dashboard (KPIs, trend charts, team breakdown).`
4. **Flag type:** Boolean. Optionally rename variations to `Released (Insights)` / `Rolled back
   (usage table)`.
5. Make sure **"SDKs using Client-side ID"** (a.k.a. *Available to client-side SDKs*) is **checked**.
   New accounts default this on; on older accounts it lives in the flag's right sidebar under
   **Advanced controls**. Without it the React app can never see the flag.
6. **Create flag**. Leave targeting **Off** for now; the default off variation should be `false`.

### 3. Copy the SDK credentials

**Settings** ⚙ → **Projects** → your project → **Environments** tab. For your chosen environment
copy:

- the **SDK key** (`sdk-…`) → goes in `server/.env` as `LD_SDK_KEY`
- the **Client-side ID** (a long hex string, no prefix) → goes in `client/.env` as `VITE_LD_CLIENT_SIDE_ID`

(Tip: pressing <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> in LaunchDarkly opens a search box where
you can type "SDK key" to copy keys quickly.)

### 4. Create the flag trigger (remediation)

1. Open the `insights-dashboard` flag. Next to the environment name click the **⋯** menu →
   **Configuration in environment**.
2. In the **Triggers** section click **+ Add trigger**.
3. **Trigger type:** `Generic trigger`. **Action:** `Turn flag off`. **Save trigger**.
4. The trigger **URL is shown exactly once**. Copy it now → `server/.env` as `LD_TRIGGER_URL`.
   (If you lose it, open the trigger's ⋯ menu and **Reset** to get a new URL.)

Triggers are per flag *and* per environment, so create it in the same environment as your keys.

> **No Triggers section?** Your plan may not include flag triggers. Skip this step and use the
> REST fallback: create an API access token under **Settings** → **Authorization** → **Create
> token** (role *Writer*), and set `LD_API_TOKEN`, `LD_PROJECT_KEY`, `LD_ENV_KEY` in `server/.env`.
> Then use `npm run remediate:api` wherever this README says `npm run remediate`.

## Run the app

```bash
# 1. Install dependencies for both workspaces (client + server)
npm install

# 2. Create your local env files from the templates
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Edit the two `.env` files and paste the values from the setup above:

- `client/.env` → `VITE_LD_CLIENT_SIDE_ID=<your client-side ID>`
- `server/.env` → `LD_SDK_KEY=<your sdk-… key>` and `LD_TRIGGER_URL=<your trigger URL>`

`.env` files are git-ignored; never commit them.

```bash
# 3. Start the API (port 3001) and the web app (port 5173) together
npm run dev
```

Open <http://localhost:5173>. You'll see the customer-facing analytics page: because the flag is off
it shows today's **Usage report**, a plain monthly table with an Export CSV button. The top-right corner has two
controls that customers would never see:

- **Part picker** (`Part 1 · Release & Remediate`) - switches between exercise parts (Part 1, Part 2,
  and the Part 3 and Part 4 extra credits). Each part has its own end-user view and admin panel; the choice is
  kept in the URL hash (`#part-1`).
- **Admin** button - opens a drawer that slides over the right edge (it never reflows the customer
  view). It holds the LaunchDarkly connection status, release instructions, demo controls, and the
  client- and server-side flag change logs. Press <kbd>Esc</kbd> to close it; it remembers whether
  it was open.

Open the Admin drawer: the header should say **connected** and the *Server listener* card
**SSE connected**.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs server (`tsx watch`) and client (Vite) with hot reload |
| `npm run build` | Compiles the server to `server/dist` and the client to `client/dist` |
| `npm run typecheck` | Type-checks both workspaces |
| `npm run remediate` | Fires the flag trigger (turns the flag off) |
| `npm run remediate:api` | Same, via the REST API (fallback) |
| `npm run setup:part2` | Configures Part 2 targeting on `landing-hero-v-2` via the REST API |
| `curl -X POST localhost:3001/api/demo/simulate-traffic -H 'Content-Type: application/json' -d '{"visitors":500}'` | Part 3: bulk experiment traffic from the Node SDK (also a button in the Admin drawer) |
| `curl -X POST localhost:3001/api/chat -H 'Content-Type: application/json' -d '{"context":{"kind":"user","key":"demo"},"message":"Where is my invoice?"}'` | Part 4: one support reply from the AI Config |
| `curl -X POST localhost:3001/api/demo/simulate-chats -H 'Content-Type: application/json' -d '{"conversations":300}'` | Part 4: synthetic conversations with feedback for the experiment |

## Demo script: release → rollback → remediate

Put the LaunchDarkly flag page and the dashboard side by side, with the **Admin** drawer open so
the logs are visible. **Never reload the browser** during the demo — that is the point.

1. **Release.** In LaunchDarkly flip `insights-dashboard` **On** and **Review and save**.
   Within about a second the table is replaced by the **Insights** dashboard: KPI tiles with
   month-over-month deltas, 30-day trend charts, and usage by team. In the Admin
   drawer, *Client listener* logs `Flag changed → true` and *Server listener* logs the same from the
   Node API. The drawer's *Server listener* card shows the API is serving the Insights data too.
2. **Rollback.** Flip the flag **Off**. The usage table is back instantly, both logs record
   `→ false`. That is your zero-downtime rollback: no deploy, no restart, no reload.
3. **Remediate (manual, via flag trigger).** Flip the flag **On** again. Now imagine an alert
   fires. In a terminal run:

   ```bash
   npm run remediate
   ```

   You'll see `HTTP 200`, the flag turns **Off** in LaunchDarkly on its own, and the dashboard
   rolls back to the usage table — again with no reload. Equivalent raw `curl`:

   ```bash
   curl -X POST "$LD_TRIGGER_URL" -H 'Content-Type: application/json' \
     -d '{"eventName":"Rolling back Insights dashboard","url":"http://localhost:5173"}'
   ```

4. **Remediate (automatic kill switch, bonus).** Flip the flag **On** once more and, in the Admin
   drawer under **Demo controls**, click **Inject bad report data**. The API now returns a malformed
   Insights payload (`series: null`), exactly like a broken upstream deploy. The dashboard
   auto-refreshes every 10 seconds (or click **Refresh**), pulls the bad payload and crashes. An error
   boundary contains it, records the error in LaunchDarkly Observability, and reports it to the API,
   which fires the same trigger. Watch the flag turn Off by itself and the UI roll back — no human in
   the loop. Rolling back also retires the bad data, so the next release renders healthy.
   Without `LD_TRIGGER_URL` the crash card instead tells the operator how to remediate by hand.
   Then open the flag's **Monitoring** tab in LaunchDarkly: **Errors** has the crash with a session
   replay, and **Logs** shows the full timeline from both the browser and the API.

5. **Audit.** Open the flag's **History** tab in LaunchDarkly: every change is attributed — your
   user for the manual toggles, and the trigger (with the `eventName` you sent) for the
   remediations.

## Part 2: Target

Select **Part 2 · Target** in the top-right picker. The end-user view becomes ABC Company's
marketing landing page; the **hero** is behind the flag **`landing-hero-v-2`**. Instead of a plain
on/off switch, LaunchDarkly evaluates the flag per visitor using **context attributes**, so you can
release the new hero to one named person, then to whole segments, while 40,000 daily visitors keep
seeing the classic version.

### The visitors (contexts)

Each persona in the Admin drawer is a LaunchDarkly **multi-context**: a `user` plus the
`organization` they belong to (`client/src/scenarios/part2/personas.ts`). Picking one calls
`identify()`, the SDK fetches that visitor's flag values, and the hero re-renders with no reload.

| Persona | `user` | `organization` | Should see | Served by |
| --- | --- | --- | --- | --- |
| Alice Chen | key `alice-chen`, country US, role admin, betaTester false | Northwind Robotics, plan **pro**, 2,400 people | Hero v2 | **Individual target** |
| Carla Ruiz | key `carla-ruiz`, country CA, role manager | Maple Health, plan **enterprise**, 180 people | Hero v2 | **Rule 2** (organization.plan) |
| Bruno Keller | key `bruno-keller`, country DE, role analyst, **betaTester true** | Keller GmbH, plan free, 12 people | Hero v2 | **Rule 1** (user.betaTester) |
| Anonymous visitor | anonymous, country US | — | Classic hero | **Default rule** |

### LaunchDarkly setup (one time)

1. **Flags → Create flag.** Name `Landing hero v2`, key **`landing-hero-v-2`**, Boolean. Enable
   **Available on client-side SDKs**. Leave targeting Off for now.
2. Open the app, pick **Part 2 · Target**, open the Admin drawer and **click through all four
   personas once**. LaunchDarkly learns context attributes from the SDK, so this makes `plan`,
   `country`, `betaTester`, … available in the rule builder.
3. On the flag's **Targeting** tab (environment `Test`):
   - **Individual targets** → *Add* → context kind **user** → `alice-chen` → variation **true**.
   - **+ Add rule** → name *Beta testers* → context kind **user**, attribute **betaTester**,
     operator *is one of*, value `true` → serve **true**.
   - **+ Add rule** → name *Enterprise organizations* → context kind **organization**, attribute
     **plan**, operator *is one of*, value `enterprise` → serve **true**.
   - **Default rule** → serve **false**.
   - Toggle the flag **On** → **Review and save**.

**Prefer a script?** The same targeting can be applied through the REST API with
`npm run setup:part2` (`scripts/setup-part2-targeting.sh`). It needs an API access token in
`server/.env` as `LD_API_TOKEN` (Organization settings → Authorization → Create token, Writer role);
`LD_PROJECT_KEY` is auto-detected when the token sees one project and `LD_ENV_KEY` defaults to
`test`. The script looks up the flag's variation IDs, then sends one semantic patch with
`addTargets`, two `addRule`s, `updateFallthroughVariationOrRollout` and `turnFlagOn`.

Rule order matters: LaunchDarkly checks individual targets first, then rules top to bottom, then
the default rule. The Evaluation card in the drawer reports which one matched (`TARGET_MATCH`,
`RULE_MATCH` + rule number, or `FALLTHROUGH`) from both the browser SDK and the Node SDK, which
evaluates the identical context via `POST /api/landing/evaluate`.

### Demo script

1. **Anonymous visitor** → classic hero; Evaluation: *Default rule* on both tiers.
2. **Alice** → v2 hero; *Individual target*. "She's on our team; she sees it before anyone."
3. **Bruno** → v2 hero with the Beta badge and EU data-residency line; *Rule 1* (a user attribute).
4. **Carla** → v2 hero with the Enterprise copy; *Rule 2*. "Targeted by her company's plan, not by her."
5. Edit a rule in LaunchDarkly (e.g. switch Rule 1 to serve false) and save: Bruno flips back to the
   classic hero instantly; Alice and Carla are untouched.

## Extra credit: Experimentation

Select **Part 3 · Experiment** in the picker. The end-user view is the Part 2 landing page,
unchanged, and the flag is the same **`landing-hero-v-2`**. What's new: the flag's **default rule**
now runs an **A/B experiment**. Every visitor who isn't served by an individual target or a rule is
split 50/50 between the classic hero and hero v2, and LaunchDarkly measures which one gets more
clicks on the hero's primary button.

### The metric (in code)

Clicking either hero's primary call to action calls `client.track()` twice
(`client/src/ld/metrics.ts`, wired in `Part2View.tsx`):

| Event key | Metric type | What it measures |
| --- | --- | --- |
| `hero-cta-click` | **Conversion** (binary) | Did this visitor click the hero's primary button? Higher is better. **This is the experiment's primary metric.** |
| `hero-cta-time-to-click` | **Numeric** (average), optional | Milliseconds from the hero rendering to the click, passed as `track()`'s `metricValue`. Lower is better. |

The *exposure* is the flag evaluation that rendered the hero (`useBoolVariation` in `HeroGate`);
the SDK reports it to LaunchDarkly, which attributes each conversion to the variation that visitor
saw. The app never needs to know which variation is control. `REPLACE ME` in `metrics.ts` and
`server/src/ld.ts` if you choose different event keys.

### LaunchDarkly setup (one time)

Experimentation is included in trials and Enterprise plans. Labels below are from the current UI;
yours may differ slightly.

1. **Create the metric.** Left nav **Metrics** → **Create metric**.
   - **Define metric using:** *LaunchDarkly hosted*. **Event kind:** *Custom*. **Event key:**
     `hero-cta-click` (must match the code exactly; *Health check waiting* just means no event has
     arrived yet - click a hero CTA in the app once and *Preview event data* fills in).
   - **Metric definition:** **Occurrence (Percent)** - whether a unit sent the event at least once.
     That is the binary conversion rate. (*Count* would reward repeat clickers; *Sum*/*Average* are
     for numeric metrics.)
   - **Metric name:** `Hero CTA click` (key auto-fills). Unit *user*, *Higher is better* if asked.
   - **Create**. The metric page should read "Percent of user units that sent the event. Higher
     is better", type *Binary*.
2. *(Optional)* A second metric: event key `hero-cta-time-to-click`, **Numeric**, **Average**,
   unit `ms`, *Lower is better*. Name it `Hero CTA time to click`.
3. **Create the experiment.** Left nav **Experimentation → Experiments → Create experiment**
   (the flag page itself has no Experimentation tab in current accounts).
   - **Name:** `Landing hero v2 vs classic`. **Hypothesis:** `If we show the personalized hero,
     more visitors click the primary CTA because the copy speaks to their plan and company.`
     **Create experiment** opens the design builder.
   - **Assignment method:** *LaunchDarkly flag or config* → **Flag or config:** `Landing hero v2`.
     Leave *Run as A/A test* unchecked. **Randomize by:** *user*.
   - **Audience allocation:** variation served to contexts outside the experiment `false`; audience
     100 %; **Control** `false` (classic hero); **split 50 / 50**. The experiment runs on the
     flag's **default rule**: the individual target and the two Part 2 rules stay above it and are
     *not* part of the experiment.
   - **Metrics:** source *LaunchDarkly hosted* → add `Hero CTA click` → **Set as primary** (add
     `Hero CTA time to click` as a secondary if you created it). Keep Bayesian.
   - **Save**, then **Start experiment**. The flag's Targeting tab now shows the default rule as an
     experiment rollout, and `curl .../sdk/latest-all` shows `fallthrough.rollout.kind = "experiment"`.
4. **Nothing else to configure in the app.** Both SDKs already send the events; the Node SDK uses
   the SDK key and the React SDK the client-side ID.

### Demo script

1. In the app pick **Part 3 · Experiment**, open the **Admin** drawer. The *Experiment* card
   explains who is in the experiment; the *Your own clicks* card shows that the current visitor
   (Anonymous by default) is served by the default rule, i.e. **in the experiment**. Switch to Alice
   in the dropdown and it says *not in experiment*: individual targets and rules win over the
   experiment's rollout.
2. Back as the Anonymous visitor, click the hero's primary button on the page (**Start free trial**
   or the v2 CTA, depending on which variation LaunchDarkly bucketed you into). The button
   acknowledges the click and the card logs `hero-cta-click · anon-visitor · classic · 12.3s`. In
   the browser's network tab, the next `POST https://events.launchdarkly.com/events/bulk/…`
   contains a `custom` event with key `hero-cta-click`.
3. **Simulate traffic.** Leave the defaults (200 visitors; classic converts 20%, hero v2 32%) and
   click **Simulate 200 visitors**. For each synthetic visitor the browser SDK calls `identify()`
   with a fresh multi-context (random user key and attributes, no beta testers, no enterprise plans,
   so all of them reach the default rule), reads the variation, and converts with the configured
   probability. Watch the hero flicker between variations on the page, the progress bar, and the
   per-variation table of exposures and conversions. A run takes ~40 s (one round trip per
   `identify()`); **Stop** ends it early. The events are flushed and your persona is restored.
4. **Bulk: 500 via API** does the same from the Node SDK (`POST /api/demo/simulate-traffic`):
   the server evaluates the flag locally for each visitor and `track()`s the conversions, so 500
   visitors take well under a second. Use it when you want significance quickly. Both runs also
   write a summary line to the flag's **Monitoring → Logs**.
5. **Read the results** in LaunchDarkly: **Experimentation → Experiments** → the experiment → **Results**.
   Data lands within a few minutes. For each variation you get **exposures**, **conversions** and
   the **conversion rate**; LaunchDarkly's Bayesian analysis adds the **probability to beat
   control** and a **credible interval** for the relative difference. With ~250 exposures per
   variation at 20% vs 32%, hero v2 shows a >95% probability to beat control. The *Hero CTA time to
   click* metric (if added) reports the mean per variation; lower wins.
6. **Ship the winner.** Stop the experiment and set the default rule to serve `true`: every visitor
   gets hero v2 instantly. Or, if v2 had lost, serve `false` and nobody outside the experiment ever
   saw it.

> **No experiment data yet?** Until the experiment is *started*, LaunchDarkly only asks the SDKs
> for summarized evaluation counts, so simulated traffic appears as flag traffic but not as
> experiment exposures. Start the experiment first, then simulate. Results also need the
> `hero-cta-click` events to arrive *after* the exposure for the same user key, which both
> simulators guarantee by evaluating before tracking.

## Extra credit: AI Configs

Select **Part 4 · AI Config**. The end-user view is ABC Analytics' **Help Center** with a support
assistant. The assistant's **model and prompt are not in the code**: they live in the LaunchDarkly
**AI Config `support-assistant`**. The product manager edits a variation's system message or swaps
its model in LaunchDarkly and the very next reply uses it. Targeting picks a variation per visitor,
the config can be toggled off as a kill switch, and an experiment compares variations on the
satisfaction, latency and token metrics the SDK reports.

**There is no real LLM behind it.** The exercise is about managing prompts and models, so the server
answers with a local deterministic responder (`server/src/ai/localResponder.ts`) that honours the
config: the prompt text decides the *style* (a prompt that says "concise" gets two terse sentences;
one that says "warm and thorough" gets a greeting, numbered steps and a plan tip), the model name
decides *latency* (names containing `mini`, `haiku`, `flash`, `nano`, `small` or `lite` answer in
~300 ms, anything else in ~1.5 s), `max_tokens` caps the reply and token counts are estimated at
four characters per token. Swap it for a real provider call and the tracking code stays the same.

### How the app uses the AI Config

```
POST /api/chat { context, message }
  └─ aiClient.completionConfig('support-assistant', context, SUPPORT_ASSISTANT_DEFAULT, { customerName, plan, company, product })
       ├─ enabled: false  → reply "assistant unavailable" (kill switch)
       └─ tracker = config.createTracker()
            respond(config.messages, config.model, …)   ← local responder (or your LLM call)
            tracker.trackDuration(ms) · trackTokens({input, output, total}) · trackSuccess()
            → { reply, served: { variationKey, version, model, provider, messages }, resumptionToken }
POST /api/chat/feedback { context, resumptionToken, kind }
  └─ aiClient.createTracker(resumptionToken, context).trackFeedback({ kind })   ← same generation (runId)
```

`server/src/ai/supportAssistant.ts` holds the config key, the in-code default (used only when
LaunchDarkly cannot serve the config), the variable mapping from the visitor's context, and the
tracker calls. `REPLACE ME` there and in `client/src/ld/flags.ts` if you name the config
differently. The metrics the tracker sends (`$ld:ai:duration:total`, `$ld:ai:tokens:*`,
`$ld:ai:generation:success`, `$ld:ai:feedback:user:*`) are what LaunchDarkly charts on the config's
**Monitoring** tab and offers as autogenerated metrics in experiments.

### LaunchDarkly setup (one time)

AI Configs live under **Agents → Configs** in the left nav (older accounts: **AI Configs**; the docs
now call the feature AgentControl). Labels may differ slightly between accounts.

1. **Create the config.** **Agents → Configs → Create config**. Type **Completion**. Name
   `Support assistant`; click **Edit key** and set the key to **`support-assistant`** (keys can't be
   changed later). **Create**. (An **Agent**-type config works too: the app detects the mode and
   reads its single *Instructions* / *Agent task* field as the system prompt. Put the same prompt
   text there.)
2. **Variation 1 – "Concise (fast model)".** On the **Variations** tab the first variation is
   waiting: name it `Concise (fast model)`. **Select a model** → pick a *small* model from the list
   (any name containing `mini`, `haiku`, `flash`, `nano`, `small` or `lite`; if none fits, **+ Add a
   model** → *Add custom model*, e.g. name `abc-support-small`, provider of your choice, model ID
   `abc-support-small`, costs 0.15 / 0.60 per million tokens). **Add parameters → Model
   parameters**: `temperature` `0.2`, `max_tokens` `120`. Leave the message role as **system** and
   paste:

   ```
   You are the {{product}} support assistant for {{company}}. The customer is {{customerName}} on the {{plan}} plan. Be concise: answer in at most two short sentences, no greetings, no emoji. If the question is about billing, say an account manager will follow up.
   ```

3. **Variation 2 – "Friendly & thorough".** **Add variation**, name `Friendly & thorough`, pick a
   *large* model (e.g. a Claude Sonnet/Opus or GPT-4-class model, or a custom `abc-support-large`
   at 3 / 15 per million), parameters `temperature` `0.7`, `max_tokens` `400`, system message:

   ```
   You are the {{product}} support assistant for {{company}}. Greet {{customerName}} by name, be warm and thorough: explain the why, give numbered steps, and mention one relevant {{plan}}-plan tip. End by asking if that solved it.
   ```

   **Review and save** → **Save**. (Each save creates a new version; the Admin drawer shows it.)
4. **Targeting** tab, environment `Test`: the config is on by default and the first variation is the
   **Default rule**. Optionally **+ Add rule** → *Enterprise organizations*: context kind
   **organization**, attribute **plan**, *is one of*, `enterprise` → serve **Friendly & thorough**,
   so Carla gets the premium experience. **Review and save**.
5. Open the app, pick **Part 4 · AI Config**, open the Admin drawer: the *Served configuration* card
   should show the variation, model and rendered prompt, reason *Default rule*. If it says
   **Fallback**, the key does not match or the SDK is offline.

### Experiment setup (optional)

The autogenerated AI metrics appear once LaunchDarkly has received the SDK's events, so **send one
chat turn and one 👍 first** (or run the simulator once).

1. **Create → Experiment** (or **Experiments → Create experiment**). Name `Support prompt: concise
   vs friendly`; hypothesis `A warm, thorough prompt on a larger model earns more positive feedback
   than a concise prompt on a small model.`
2. **Design:** assignment method **LaunchDarkly flag or config** → `support-assistant` → targeting
   rule **Default rule** → **Randomize by** `user` → audience 100 % → **Control** `Concise (fast
   model)` → **Split equally**.
3. **Metrics:** source LaunchDarkly → primary **Positive AI feedback rate** (higher is better);
   secondaries **Average AI completion time** and **Average total tokens per AI completion** (lower
   is better). Keep Bayesian. **Save**, then **Start**.

### Demo script

1. **Chat.** As the Anonymous visitor click *Where is my invoice?*. A two-sentence answer arrives in
   about 300 ms. The drawer: variation *Concise (fast model)*, your small model, *Default rule*,
   the rendered prompt with `there` / `free` / `your team` filled in. Click **👍**: the *Turns* row
   shows the rating and `POST /api/chat/feedback` attaches it to that generation.
2. **Switch to Carla** in the drawer. With the enterprise rule she gets *Friendly & thorough*: "Hi
   Carla, sorry you're locked out…", numbered steps, an enterprise tip, and ~1.5 s latency from the
   large model. Same code; the configuration did the work.
3. **Edit the prompt in LaunchDarkly.** Change the Concise variation's message to "…be warm and
   thorough, give numbered steps…", **Review and save**, ask again as Anonymous: the style flips and
   the drawer shows the new version number. Revert when done.
4. **Kill switch.** Toggle the config **off**: the next question gets the "taking a break" banner and
   the drawer pill reads *Config off*. Toggle it back on.
5. **Simulate conversations.** Leave the defaults (300 conversations × 2 turns; concise prompts get
   👍 55 % of the time, friendly ones 80 %) and click **Simulate 300 conversations**. In under two
   seconds the API evaluates the config for 300 random visitors (fresh user keys, so each is its
   own experiment bucket), generates replies, records duration and tokens, and rates them. The table
   shows turns, 👍 rate, average ms and tokens per variation.

   ```bash
   curl -X POST localhost:3001/api/demo/simulate-chats -H 'Content-Type: application/json' \
     -d '{"conversations":300,"turns":2,"positiveConcise":0.55,"positiveFriendly":0.8}'
   ```

6. **Read the results.** On the config's **Monitoring** tab: *Generations*, *Satisfaction* (👍
   rate), *Time to generate*, *Tokens* and *Costs* per variation. On the experiment's **Results**
   tab: *Positive AI feedback rate* per variation with the probability to beat control, and the
   price of that satisfaction in completion time and tokens. "Friendly wins 80 % vs 55 % on
   satisfaction, at 4× the latency and 3× the tokens." Ship the winner by editing the default rule,
   or target it only where it pays (enterprise) - all in LaunchDarkly, no deploy.

## How it works

**Flag evaluation and the listener (client).** `client/src/components/FeatureGate.tsx` calls
`useBoolVariation('insights-dashboard', false)`. The hook returns the value for the current context
*and* subscribes the component to changes; the SDK keeps a streaming connection to LaunchDarkly,
so a toggle produces a re-render with no polling and no reload. The default `false` means the app
fails closed to today's usage table if LaunchDarkly is unreachable.
`FlagActivityLog.tsx` registers the lower-level `client.on('change:insights-dashboard', …)` event
explicitly so you can see the mechanism the hook is built on.

**Flag evaluation and the listener (server).** `server/src/ld.ts` creates one `LDClient` for the
process (always a singleton) and waits for initialization. `routes/reports.ts` evaluates the flag
per request from the SDK's in-memory store (no network call). `routes/flagEvents.ts` registers
`ldClient.on('update:insights-dashboard', …)`, re-evaluates, and broadcasts over SSE.

**Observability.** Both tiers are instrumented.
- Browser: `client/src/ld/provider.ts` adds the `@launchdarkly/observability` and
  `@launchdarkly/session-replay` plugins. They reuse the client-side ID (no extra keys) and send
  errors, network calls, Web Vitals and a replay of each session to **Observability** in LaunchDarkly.
  The error boundary calls `LDObserve.recordError(...)` explicitly because an error caught by a
  boundary is not "uncaught" and would otherwise be missed. `privacySetting: 'default'` masks form
  inputs but keeps text readable; use `'strict'` with real customer data.
- API: `server/src/ld.ts` adds `@launchdarkly/observability-node` to the Node SDK (it authenticates
  with the SDK key), so server-side flag evaluations, logs and traces land in the same place.
- **Flag-scoped logs and errors.** The flag's **Monitoring** tab (Errors, Logs, Traces) only shows
  telemetry LaunchDarkly can tie to the flag: spans that carry the `feature_flag.*` attributes
  (`feature_flag.key`, `feature_flag.set.id`, `feature_flag.result.value`, …) and contain a flag
  evaluation, which is exactly what the plugins emit for every evaluation. Both tiers therefore go
  through small helpers (`logFlagEvent()` / `recordFlagError()` in `client/src/ld/telemetry.ts`,
  `logFlagEvent()` in `server/src/ld.ts`) that open such a span, evaluate the flag inside it, and
  record the log or error there. The whole incident then reads as one timeline under the flag:
  flag changed → bad data injected → crash → crash reported → trigger fired → chaos reset → flag
  changed, grouped by variation. Untagged `console.*` output still appears on the account-wide
  Observability → Logs page.

**Remediation.** A flag trigger is an unguessable webhook URL bound to one action on one flag in
one environment. Anything that can make an HTTP POST — curl, an APM alert, this app's
`POST /api/report-error` handler — can flip the flag. Rate limiting on LaunchDarkly's side keeps a
flapping alert from toggling the flag endlessly.

**Going further: guarded rollouts.** The observability plugins also produce an autogenerated
*User error rate* metric. On plans with the Guardian add-on you can attach it to the flag and run a
**guarded rollout**: LaunchDarkly ramps the new variation up gradually, watches the metric, and rolls
back on its own when the error rate regresses — the same outcome as this demo's trigger, driven by
statistics instead of a webhook. It needs real traffic to reach significance, so this demo keeps the
trigger as the remediation path (which is also what the exercise asks for).

**Context.** The browser identifies as `{ kind: 'user', key: 'demo-user-001', name: 'Demo User' }`
(`client/src/ld/provider.ts`). Part 1 only needs a stable identity; Part 2 (targeting) extends this
context with attributes.

## Project layout

```
.
├── package.json              npm workspaces + root scripts (dev, build, remediate)
├── client/                   Vite + React 19 + TypeScript
│   ├── .env.example          VITE_LD_CLIENT_SIDE_ID
│   └── src/
│       ├── App.tsx           top bar (part picker + Admin toggle), end-user view, admin drawer
│       ├── scenarios/        one entry per exercise part: { View, Admin }
│       │   ├── part1/        Part1View (FeatureGate), Part1Admin (controls + logs)
│       │   ├── part2/        Part2View (landing page, HeroGate + CTA tracking), Part2Admin (personas, evaluation), personas.ts, personaStore.ts
│       │   ├── part3/        Part3Admin (experiment panel), simulateTraffic.ts (identify → evaluate → track loop), syntheticVisitors.ts
│       │   └── part4/        Part4View (Help Center chat with 👍/👎), Part4Admin (served config, turns, simulator), chatStore.ts
│       ├── ld/provider.ts    createLDReactProvider (client-side ID, context, streaming, observability plugins)
│       ├── ld/telemetry.ts   logFlagEvent(): flag-tagged logs for Monitoring > Logs
│       ├── ld/metrics.ts     METRIC_EVENTS + trackHeroCtaClick(): client.track() for the experiment metrics
│       ├── ld/flags.ts       flag keys
│       ├── components/
│       │   ├── AdminDrawer.tsx         collapsible overlay for admin tooling
│       │   ├── FeatureGate.tsx         useBoolVariation → Insights dashboard or usage table
│       │   ├── UsageReportTable.tsx    the legacy report (flag off)
│       │   ├── InsightsDashboard.tsx   the new feature (flag on): KPIs, trend charts, team breakdown
│       │   ├── PanelErrorBoundary.tsx  catches the crash, records it in Observability, calls /api/report-error
│       │   ├── FlagActivityLog.tsx     explicit client.on('change:…') listener
│       │   └── ServerStatus.tsx        SSE view of the server-side listener
│       └── useUsageReport.ts, api.ts
├── server/                   Express 5 + TypeScript
│   ├── .env.example          LD_SDK_KEY, LD_TRIGGER_URL, API_PORT (+ REST fallback vars)
│   └── src/
│       ├── ld.ts             Node SDK singleton + observability plugin, logFlagEvent(), METRIC_EVENTS
│       ├── ai/supportAssistant.ts   AI SDK client, completionConfig() + tracker (duration, tokens, success, feedback)
│       ├── ai/localResponder.ts     deterministic stand-in for the LLM (style from prompt, latency from model name)
│       ├── demo.ts           demo-only chaos state (malformed Insights payload)
│       ├── synthetic.ts      random visitors for the bulk simulations
│       ├── index.ts          app wiring, graceful shutdown (flush + close)
│       └── routes/           reports.ts, flagEvents.ts (SSE listener), remediate.ts, demo.ts (chaos + simulators), landing.ts (Part 2 evaluate), chat.ts (Part 4)
├── scripts/
│   ├── remediate.sh          curl → flag trigger
│   ├── remediate-api.sh      curl → REST API semantic patch (turnFlagOff)
│   └── setup-part2-targeting.sh   REST API semantic patch: targets + rules for Part 2
└── docs/                     part1-…, part2-targeting.md, part3-experimentation.md, part4-ai-configs.md (reviewer walkthroughs)
```

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Yellow banner: `VITE_LD_CLIENT_SIDE_ID is not set` | Create `client/.env` from the example, paste the client-side ID, restart `npm run dev` (Vite reads env at startup). |
| Header shows `LaunchDarkly: failed` | Wrong client-side ID, or you pasted the SDK key by mistake. The client-side ID has no `sdk-` prefix. |
| Flag toggles do nothing in the browser, but the server log shows the change | The flag is not available to client-side SDKs. Open the flag → right sidebar → **Advanced controls** → enable **SDKs using Client-side ID**. |
| Server exits with `LD_SDK_KEY is not set` | Create `server/.env` from the example and paste the `sdk-…` key. |
| Server log: `Server SDK failed to initialize` | Wrong SDK key, or no network. Flags fall back to defaults (usage table). |
| `npm run remediate` → `LD_TRIGGER_URL is not set` | Create the trigger (setup step 4) or use `npm run remediate:api`. |
| `npm run remediate` → HTTP 401/404 | The trigger URL was reset or belongs to another environment. Reset it in LaunchDarkly and update `server/.env`. |
| Admin drawer says `disconnected` for the server listener | The API isn't running on 3001. Check the `server` lines in the `npm run dev` output. |
| Nothing under Observability → Errors in LaunchDarkly | Events batch and can take a minute to appear. Reload the page once after setting the client-side ID; check the browser console for plugin errors. |
| Flag → Monitoring → Logs/Errors is empty but the account-wide Observability pages have data | The flag views only show telemetry recorded inside a span that carries `feature_flag.*` attributes and a flag evaluation. Use `logFlagEvent()` / `recordFlagError()` for anything you want attributed to the flag; widen the time range selector. |
| Rule builder doesn't offer `plan` / `betaTester` | LaunchDarkly lists attributes it has seen from SDKs. Open Part 2 and click through the personas, then reload the flag page. You can also type the attribute name manually. |
| Evaluation card says `Error: FLAG_NOT_FOUND` or `CLIENT_NOT_READY` | The `landing-hero-v-2` flag doesn't exist yet, isn't client-side available, or the SDK is still initializing. |
| Alice sees v2 but the reason is a rule, not Individual target | Individual targets win over rules. If the reason is `RULE_MATCH`, the individual target wasn't saved. |
| Experiment Results stay empty after simulating | The experiment wasn't started yet when the traffic ran (only summary events are sent until then), or the metric's event key doesn't match `hero-cta-click` in `client/src/ld/metrics.ts`. Start the experiment, run the simulation again, wait a few minutes. |
| Experiment shows exposures but no conversions | The metric was created with a different event key or the wrong randomization unit (it must be `user`). Check Metrics → the metric → event key, then the **Your own clicks** log and the `events/bulk` request payload. |
| Simulation is slow or logs identify errors | Each browser visitor is one `identify()` round trip (~200 ms). Use **Bulk via API** for volume; identify errors usually mean the network dropped - the run continues. |
| Part 4 drawer pill says **Fallback** | LaunchDarkly did not serve `support-assistant`: the config doesn't exist yet, its key differs from `server/src/ld.ts`, or the server SDK isn't initialized. The in-code default answers meanwhile. |
| Part 4 chat shows the "taking a break" banner | The config is toggled **off** in this environment (`enabled: false`). That's the kill switch working; turn it back on. |
| Experiment builder doesn't offer the AI metrics | LaunchDarkly creates them after the first `$ld:ai:*` events arrive. Send one chat turn and a 👍 (or run the simulator), wait a minute, reload the builder. |
| Replies don't change after editing the variation | Check the drawer's version number: if it didn't bump, the change wasn't saved (**Review and save**). The responder keys on the words *concise* vs *warm/thorough/numbered steps* and on the model name. |
| Port already in use | Change `API_PORT` in `server/.env` **and** the proxy target in `client/vite.config.ts`. |
