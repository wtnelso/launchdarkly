/**
 * LaunchDarkly Node.js server SDK singleton.
 *
 * The server SDK keeps an in-memory copy of every flag in the environment and
 * holds a streaming connection open to LaunchDarkly, so flag changes made in
 * the UI (or by a trigger) reach this process in well under a second.
 *
 * IMPORTANT: create exactly ONE LDClient per process. Never create one per request.
 */
import { init, type LDClient, type LDContext } from '@launchdarkly/node-server-sdk';

// REPLACE ME: the SDK key is read from server/.env (see server/.env.example).
// It is the *server-side SDK key* ("sdk-...") for your project + environment,
// NOT the client-side ID used by the React app.
const sdkKey = process.env.LD_SDK_KEY;

if (!sdkKey) {
  console.error(
    '\n[LaunchDarkly] LD_SDK_KEY is not set.\n' +
      '  1. Copy server/.env.example to server/.env\n' +
      '  2. Paste your server-side SDK key from LaunchDarkly > Organization settings > Projects > Environments\n',
  );
  process.exit(1);
}

/** Flag keys used by this demo. Keep in sync with client/src/ld/flags.ts. */
export const FLAG_KEYS = {
  /**
   * REPLACE ME if you named your flag differently.
   * Boolean flag that releases (true) or rolls back (false) the new Insights
   * reporting dashboard. false = today's plain usage report table.
   */
  INSIGHTS_DASHBOARD: 'insights-dashboard',
} as const;

/**
 * The context the server evaluates flags against.
 *
 * In Part 1 the flag is a simple on/off release switch, so one shared
 * "service" context is enough. Part 2 (targeting) replaces this with the
 * real end-user's context so individual and rule-based targeting work.
 */
export const serverContext: LDContext = {
  kind: 'user',
  key: 'abc-analytics-api',
  name: 'ABC Analytics API (server)',
};

export const ldClient: LDClient = init(sdkKey, {
  // Streaming is the default and is what makes server-side "listeners" instant.
  // Shown here explicitly so it is obvious during the demo.
  stream: true,
});

/**
 * Wait for the SDK to download its initial flag set. Until this resolves,
 * variation() calls return the default values you pass them.
 */
export async function waitForLaunchDarkly(): Promise<void> {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('[LaunchDarkly] Server SDK initialized - streaming flag updates');
  } catch (err) {
    console.error('[LaunchDarkly] Server SDK failed to initialize (check LD_SDK_KEY):', err);
    // Keep running: variation() falls back to defaults, which is the safe behaviour.
  }
}

/** Evaluate the Part 1 release flag for the server context. */
export function isNewReportingOn(): Promise<boolean> {
  return ldClient.boolVariation(FLAG_KEYS.INSIGHTS_DASHBOARD, serverContext, false);
}
