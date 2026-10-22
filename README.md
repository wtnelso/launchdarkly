# ABC Company Analytics — LaunchDarkly sample

A React (Vite) web app and a Node (Express) API that use LaunchDarkly feature flags, targeting,
experimentation and an AI Config. This file covers setup and running only; the per-part
walkthroughs are in `docs/`.

## Prerequisites

- **Operating system:** macOS or Linux with a `bash` shell and `curl`. On Windows use WSL or Git Bash.
- **Git**, to clone the repository.
- **Node.js 20 or newer** and **npm 10 or newer**. Tested with Node 22.22 and npm 10.9. Check with
  `node -v` and `npm -v`. To install: download the LTS build from <https://nodejs.org>, or with nvm:
  `nvm install 22 && nvm use 22` (the repo has an `.nvmrc`, so `nvm use` alone also works). npm
  ships with Node; no global npm packages are needed.
- **Network access** during `npm install` (registry.npmjs.org) and while running (the app talks to
  `*.launchdarkly.com` for flag streaming, events and observability).
- Ports **5173** (web app) and **3001** (API) are free.
- A **LaunchDarkly account**. A free trial is enough; flag triggers, Experimentation and AI Configs
  are included in trials. All steps below use **one environment** (they assume `Test`).
- Nothing else: no database, no other services, no LLM API key (the Part 4 chatbot answers with a
  local stand-in).

## Setup

### 1. Get the code and install dependencies

```bash
git clone https://github.com/wtnelso/launchdarkly.git
cd launchdarkly
npm install
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Run every later command from this directory. The project is an **npm workspaces** monorepo with
two packages, `client/` and `server/`; the single `npm install` at the root installs both.
`package-lock.json` is committed, so `npm ci` gives an exact reproduction if preferred.

What gets installed:

| Package | Runtime dependencies | Dev tooling |
| --- | --- | --- |
| `client/` (web app) | `react` 19, `react-dom` 19, `@launchdarkly/react-sdk` 4.1, `@launchdarkly/observability` 1.2, `@launchdarkly/session-replay` 1.2 | `vite` 8, `@vitejs/plugin-react` 6, `typescript` 5.9, React type packages |
| `server/` (API) | `express` 5, `cors` 2, `dotenv` 18, `@launchdarkly/node-server-sdk` 9.15, `@launchdarkly/observability-node` 1.4, `@launchdarkly/server-sdk-ai` 2.0 | `tsx` 4 (runs TypeScript directly, with watch mode), `typescript` 5.9, Node/Express type packages |
| root | — | `concurrently` 9 (runs both processes under `npm run dev`) |

### 2. Add your LaunchDarkly keys

In LaunchDarkly open **Organization settings → Projects → your project → Environments** and, for the
environment you will use, copy:

| Value | Format | Put it in |
| --- | --- | --- |
| **SDK key** | `sdk-…` (keep secret) | `server/.env` → `LD_SDK_KEY=` |
| **Client-side ID** | long hex string, no prefix | `client/.env` → `VITE_LD_CLIENT_SIDE_ID=` |
| **Trigger URL** (created in step 3b) | `https://app.launchdarkly.com/webhook/triggers/…` | `server/.env` → `LD_TRIGGER_URL=` |

The `.env` files are git-ignored. Restart `npm run dev` after editing them.

### 3. Create the LaunchDarkly objects

Use these exact keys; the code references them (see [Where keys live in the code](#where-keys-live-in-the-code)).

**3a. Flag `insights-dashboard` (Part 1).**
1. **Flags → Create flag**. Name `Insights dashboard`; the key auto-fills as `insights-dashboard`.
2. Flag type **Boolean**. Make sure **Available on client-side SDKs** is checked.
3. **Create flag**. Leave targeting **Off**; the off variation must be `false`.

**3b. Flag trigger (Part 1).**
1. On the flag, click **⋯** next to the environment → **Configuration in environment**.
2. **Triggers → + Add trigger**. Trigger type **Generic trigger**, action **Turn flag off**. Save.
3. Copy the URL (it is shown once) into `server/.env` as `LD_TRIGGER_URL`.
4. If your plan has no Triggers section: create an API access token (**Organization settings →
   Authorization → Create token**, role Writer), put it in `server/.env` as `LD_API_TOKEN`, and
   use `npm run remediate:api` wherever `npm run remediate` is mentioned.

**3c. Flag `landing-hero-v-2` (Parts 2 and 3).**
1. **Flags → Create flag**. Name `Landing hero v2`, key `landing-hero-v-2`, Boolean, client-side
   SDKs on. Create.
2. Start the app (see [Run](#run)), pick **Part 2 · Target** in the Admin drawer and click each of
   the four personas once, so LaunchDarkly has seen the context attributes.
3. On the flag's **Targeting** tab:
   - **Individual targets** → context kind `user` → `alice-chen` → variation `true`.
   - **+ Add rule** `Beta testers`: `user` · `betaTester` · is one of · `true` → `true`.
   - **+ Add rule** `Enterprise organizations`: `organization` · `plan` · is one of · `enterprise` → `true`.
   - Default rule → `false`. Toggle the flag **On**. **Review and save**.
   Alternative: `npm run setup:part2` applies the same targeting through the REST API (needs
   `LD_API_TOKEN` in `server/.env`; `LD_PROJECT_KEY` and `LD_ENV_KEY` are optional, default `test`).

**3d. Metric and experiment (Part 3).**
1. **Metrics → Create metric**. Define using **LaunchDarkly hosted**, event kind **Custom**, event
   key `hero-cta-click`, metric definition **Occurrence (Percent)**, name `Hero CTA click`,
   unit `user`, **Higher is better**. Create.
2. **Experimentation → Experiments → Create experiment**. Name `Landing hero v2 vs classic`.
3. In the design: assignment method **LaunchDarkly flag or config** → flag `Landing hero v2` →
   randomize by **user** → targeting rule **Default rule** → audience 100 % → control `false` →
   split equally. Metrics: add `Hero CTA click` and set it as primary. **Save**, then **Start**.
4. Optional second metric: event key `hero-cta-time-to-click`, definition **Average**, unit
   `user`, lower is better.

**3e. AI Config `support-assistant` (Part 4).**
1. **Agents → Configs → Create config** (older accounts: **AI Configs**). Name `Support assistant`,
   click **Edit key** and set `support-assistant`. Either the **Completion** or the **Agent** type
   works. Create.
2. On **Variations**, create two variations. Any model works; a custom model is fine
   (**Select a model → + Add a model**, costs e.g. `0.15 / 0.60` and `3 / 15` per million tokens).
   Put the prompt in the system message (Completion type) or the *Agent task* field (Agent type).

   | Variation name | Model | Model parameters | Prompt |
   | --- | --- | --- | --- |
   | `Concise (fast model)` | a small model: name containing `mini`, `haiku`, `flash`, `nano`, `small` or `lite`, e.g. custom `abc-support-small` | `{"temperature": 0.2, "max_tokens": 120}` | `You are the {{product}} support assistant for {{company}}. The customer is {{customerName}} on the {{plan}} plan. Be concise: answer in at most two short sentences, no greetings, no emoji. If the question is about billing, say an account manager will follow up.` |
   | `Friendly & thorough` | a large model, e.g. custom `abc-support-large` | `{"temperature": 0.7, "max_tokens": 400}` | `You are the {{product}} support assistant for {{company}}. Greet {{customerName}} by name, be warm and thorough: explain the why, give numbered steps, and mention one relevant {{plan}}-plan tip. End by asking if that solved it.` |

3. **Review and save**.
4. On **Targeting**: default rule → **Concise (fast model)**. Optionally **+** add a rule
   `organization` · `plan` · is one of · `enterprise` → **Friendly & thorough**. **Review and save**.
5. Optional experiment on the config: in the app, send one chat message and click 👍 (this
   creates LaunchDarkly's AI metrics), then **Create experiment** → config `support-assistant` →
   default rule → randomize by `user` → control Concise → primary metric **Positive AI feedback
   rate** → Save → Start.

**3f. Optional metric `insights-dashboard-crash` (Part 1 guarded rollout).** Custom event key
`insights-dashboard-crash`, **Occurrence (Percent)**, unit `user`, **Lower is better**. Only needed
if you run `insights-dashboard` as a guarded rollout.

## Run

```bash
npm run dev
```

This starts the API on <http://localhost:3001> (`tsx watch`, restarts on changes) and the web app
on <http://localhost:5173> (Vite dev server with hot reload) in one terminal. The web app proxies
`/api/*` to the API, so only the web app URL is opened in the browser. Open <http://localhost:5173>.
Stop both with Ctrl+C. A production-style run is `npm run build`, then `npm start -w server` and
`npm run preview -w client`.

- The **☰** button (top right) opens the Admin drawer. Its header shows the LaunchDarkly connection
  status; it should read **connected**. The **Exercise part** dropdown at the top of the drawer
  switches between Parts 1–4; the choice is kept in the URL hash (`#part-1` … `#part-4`).
- Each part's demo controls and flag logs are in the same drawer.

| Command | What it does |
| --- | --- |
| `npm run dev` | Run API and web app with hot reload |
| `npm run build` | Compile both to `server/dist` and `client/dist` |
| `npm run typecheck` | Type-check both workspaces |
| `npm run remediate` | Fire the flag trigger to turn `insights-dashboard` off |
| `npm run remediate:api` | Same via the REST API (needs `LD_API_TOKEN`) |
| `npm run setup:part2` | Apply the Part 2 targeting via the REST API |

Quick checks after starting: the Admin drawer says **connected**; toggling `insights-dashboard`
in LaunchDarkly swaps Part 1's page with no reload; Part 4's drawer shows the served variation
(not *Fallback*) once `support-assistant` exists.

## Where keys live in the code

Every value tied to your LaunchDarkly account is marked with a `REPLACE ME` comment:

| File | What to replace |
| --- | --- |
| `server/.env.example` | `LD_SDK_KEY`, `LD_TRIGGER_URL`; optional `LD_API_TOKEN`, `LD_PROJECT_KEY`, `LD_ENV_KEY`, `LD_ENVIRONMENT_ID` |
| `client/.env.example` | `VITE_LD_CLIENT_SIDE_ID` |
| `server/src/ld.ts` | reads `LD_SDK_KEY`; `FLAG_KEYS` (`insights-dashboard`, `landing-hero-v-2`, `support-assistant`) and `METRIC_EVENTS` |
| `client/src/ld/flags.ts` | the same flag keys for the browser |
| `client/src/ld/metrics.ts` | metric event keys `hero-cta-click`, `hero-cta-time-to-click`, `insights-dashboard-crash` |
| `client/src/ld/provider.ts` | reads `VITE_LD_CLIENT_SIDE_ID` |
| `client/src/scenarios/part2/personas.ts` | persona keys and attributes the Part 2 targeting matches on |
| `server/src/routes/remediate.ts` | reads `LD_TRIGGER_URL` |

If you rename a flag, metric or config in LaunchDarkly, change the matching constant in those files.

Walkthroughs for each part: `docs/part1-release-and-remediate.md`, `docs/part2-targeting.md`,
`docs/part3-experimentation.md`, `docs/part4-ai-configs.md`.
