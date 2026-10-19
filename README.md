# ABC Company Billing Dashboard — LaunchDarkly Release & Remediate demo

A small React + Node application that shows how ABC Company can **ship features faster without
adding risk** by wrapping new code in a LaunchDarkly feature flag:

| Expectation | How this app demonstrates it |
| --- | --- |
| **Feature flag** around a new feature | The redesigned pricing panel is gated by the boolean flag `new-pricing-panel`. Flag **on** = released, **off** = rolled back to the legacy panel. |
| **Instant release / rollback** (a "listener", no page reload) | The React SDK's `useBoolVariation` hook and an explicit `client.on('change:new-pricing-panel')` listener re-render the page the moment the flag changes. The Node API registers `ldClient.on('update:new-pricing-panel')` and pushes the change to the browser over Server-Sent Events, so you can watch both tiers flip together. |
| **Remediate** with a trigger | `npm run remediate` POSTs to a LaunchDarkly **flag trigger** with `curl`, turning the flag off. The UI also has a "Simulate production bug" button; when the new panel crashes, the server can fire the same trigger automatically (an automatic kill switch). |

This is **Part 1 (Release and Remediate)** of the LaunchDarkly SE technical exercise. Code paths
that depend on *your* LaunchDarkly account are marked with `REPLACE ME` comments.

---

## Contents

1. [Architecture](#architecture)
2. [Prerequisites and assumptions](#prerequisites-and-assumptions)
3. [LaunchDarkly setup (one time)](#launchdarkly-setup-one-time)
4. [Run the app](#run-the-app)
5. [Demo script: release → rollback → remediate](#demo-script-release--rollback--remediate)
6. [How it works](#how-it-works)
7. [Project layout](#project-layout)
8. [Troubleshooting](#troubleshooting)

---

## Architecture

```
 Browser (http://localhost:5173)                      LaunchDarkly
 ┌──────────────────────────────────┐   streaming     ┌──────────────────┐
 │ React 19 + Vite                  │◄───────────────►│  flag:           │
 │ @launchdarkly/react-sdk          │  client-side ID │  new-pricing-    │
 │  • useBoolVariation()  (gate)    │                 │  panel           │
 │  • client.on('change:…') (log)   │                 │                  │
 └───────────────┬──────────────────┘                 │  flag trigger    │
                 │ /api/* (Vite proxy)                │  (webhook URL)   │
 ┌───────────────▼──────────────────┐   streaming     │        ▲         │
 │ Express 5 (http://localhost:3001)│◄───────────────►│        │         │
 │ @launchdarkly/node-server-sdk    │  SDK key        └────────┼─────────┘
 │  • GET  /api/pricing             │                          │ POST
 │  • GET  /api/flag-events (SSE)   │      curl (npm run remediate)
 │  • POST /api/report-error ───────┼──────────────────────────┘
 └──────────────────────────────────┘
```

- **Client** evaluates the flag with the LaunchDarkly **client-side ID** (safe in browsers).
- **Server** evaluates the same flag with the **server-side SDK key** (secret) and serves
  flag-dependent pricing data, so the demo shows the whole stack switching, not just the UI.
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
2. **Name:** `New pricing panel`. The **key** auto-fills as `new-pricing-panel` — **keep this
   exact key** (the code references it in `client/src/ld/flags.ts` and `server/src/ld.ts`; if you
   change it, change it there too).
3. **Description:** `Releases the redesigned 3-tier pricing panel on the billing dashboard.`
4. **Flag type:** Boolean. Optionally rename variations to `Released (new panel)` / `Rolled back
   (legacy)`.
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

1. Open the `new-pricing-panel` flag. Next to the environment name click the **⋯** menu →
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

Open <http://localhost:5173>. The header should say **LaunchDarkly: connected**, the sidebar's
*Server listener* card should say **SSE connected**, and because the flag is off you should see the
plain **Plans & Pricing** table (the legacy panel).

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs server (`tsx watch`) and client (Vite) with hot reload |
| `npm run build` | Compiles the server to `server/dist` and the client to `client/dist` |
| `npm run typecheck` | Type-checks both workspaces |
| `npm run remediate` | Fires the flag trigger (turns the flag off) |
| `npm run remediate:api` | Same, via the REST API (fallback) |

## Demo script: release → rollback → remediate

Put the LaunchDarkly flag page and the dashboard side by side. **Never reload the browser** during
the demo — that is the point.

1. **Release.** In LaunchDarkly flip `new-pricing-panel` **On** and **Review and save**.
   Within about a second the dashboard swaps to the redesigned three-tier panel. In the sidebar,
   *Client listener* logs `Flag changed → true` and *Server listener* logs the same from the Node
   API. The panel's footer shows `server variant "new"`: the API is serving new pricing too.
2. **Rollback.** Flip the flag **Off**. The legacy table is back instantly, both logs record
   `→ false`. That is your zero-downtime rollback: no deploy, no restart, no reload.
3. **Remediate (manual, via flag trigger).** Flip the flag **On** again. Now imagine an alert
   fires. In a terminal run:

   ```bash
   npm run remediate
   ```

   You'll see `HTTP 200`, the flag turns **Off** in LaunchDarkly on its own, and the dashboard
   rolls back to the legacy panel — again with no reload. Equivalent raw `curl`:

   ```bash
   curl -X POST "$LD_TRIGGER_URL" -H 'Content-Type: application/json' \
     -d '{"eventName":"Rolling back new pricing panel","url":"http://localhost:5173"}'
   ```

4. **Remediate (automatic kill switch, bonus).** Flip the flag **On** once more and click
   **Simulate production bug** inside the new panel. The panel crashes, an error boundary contains
   it (the rest of the dashboard keeps working) and reports it to the API, and the API fires the
   same trigger. Watch the flag turn Off by itself and the UI roll back — no human in the loop.
   Without `LD_TRIGGER_URL` the crash card instead tells the operator how to remediate by hand.

5. **Audit.** Open the flag's **History** tab in LaunchDarkly: every change is attributed — your
   user for the manual toggles, and the trigger (with the `eventName` you sent) for the
   remediations.

## How it works

**Flag evaluation and the listener (client).** `client/src/components/FeatureGate.tsx` calls
`useBoolVariation('new-pricing-panel', false)`. The hook returns the value for the current context
*and* subscribes the component to changes; the SDK keeps a streaming connection to LaunchDarkly,
so a toggle produces a re-render with no polling and no reload. The default `false` means the app
fails closed to the legacy panel if LaunchDarkly is unreachable.
`FlagActivityLog.tsx` registers the lower-level `client.on('change:new-pricing-panel', …)` event
explicitly so you can see the mechanism the hook is built on.

**Flag evaluation and the listener (server).** `server/src/ld.ts` creates one `LDClient` for the
process (always a singleton) and waits for initialization. `routes/pricing.ts` evaluates the flag
per request from the SDK's in-memory store (no network call). `routes/flagEvents.ts` registers
`ldClient.on('update:new-pricing-panel', …)`, re-evaluates, and broadcasts over SSE.

**Remediation.** A flag trigger is an unguessable webhook URL bound to one action on one flag in
one environment. Anything that can make an HTTP POST — curl, an APM alert, this app's
`POST /api/report-error` handler — can flip the flag. Rate limiting on LaunchDarkly's side keeps a
flapping alert from toggling the flag endlessly.

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
│       ├── ld/provider.ts    createLDReactProvider (client-side ID, context, streaming)
│       ├── ld/flags.ts       flag keys
│       ├── components/
│       │   ├── FeatureGate.tsx         useBoolVariation → New or Legacy panel
│       │   ├── NewPricingPanel.tsx     the flagged feature (+ "Simulate production bug")
│       │   ├── LegacyPricingPanel.tsx  the rollback target
│       │   ├── PanelErrorBoundary.tsx  catches the crash, calls /api/report-error
│       │   ├── FlagActivityLog.tsx     explicit client.on('change:…') listener
│       │   └── ServerStatus.tsx        SSE view of the server-side listener
│       └── usePricing.ts, api.ts
├── server/                   Express 5 + TypeScript
│   ├── .env.example          LD_SDK_KEY, LD_TRIGGER_URL, PORT (+ REST fallback vars)
│   └── src/
│       ├── ld.ts             Node SDK singleton, waitForInitialization
│       ├── index.ts          app wiring, graceful shutdown (flush + close)
│       └── routes/           pricing.ts, flagEvents.ts (SSE listener), remediate.ts
├── scripts/
│   ├── remediate.sh          curl → flag trigger
│   └── remediate-api.sh      curl → REST API semantic patch (turnFlagOff)
└── docs/part1-release-and-remediate.md   reviewer walkthrough
```

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Yellow banner: `VITE_LD_CLIENT_SIDE_ID is not set` | Create `client/.env` from the example, paste the client-side ID, restart `npm run dev` (Vite reads env at startup). |
| Header shows `LaunchDarkly: failed` | Wrong client-side ID, or you pasted the SDK key by mistake. The client-side ID has no `sdk-` prefix. |
| Flag toggles do nothing in the browser, but the server log shows the change | The flag is not available to client-side SDKs. Open the flag → right sidebar → **Advanced controls** → enable **SDKs using Client-side ID**. |
| Server exits with `LD_SDK_KEY is not set` | Create `server/.env` from the example and paste the `sdk-…` key. |
| Server log: `Server SDK failed to initialize` | Wrong SDK key, or no network. Flags fall back to defaults (legacy panel). |
| `npm run remediate` → `LD_TRIGGER_URL is not set` | Create the trigger (setup step 4) or use `npm run remediate:api`. |
| `npm run remediate` → HTTP 401/404 | The trigger URL was reset or belongs to another environment. Reset it in LaunchDarkly and update `server/.env`. |
| Sidebar says `disconnected` for the server listener | The API isn't running on 3001. Check the `server` lines in the `npm run dev` output. |
| Port already in use | Change `PORT` in `server/.env` **and** the proxy target in `client/vite.config.ts`. |
