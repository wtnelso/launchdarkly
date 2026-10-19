/**
 * LaunchDarkly Node.js server SDK singleton.
 *
 * The server SDK keeps an in-memory copy of every flag in the environment and
 * holds a streaming connection open to LaunchDarkly, so flag changes made in
 * the UI (or by a trigger) reach this process in well under a second.
 *
 * IMPORTANT: create exactly ONE LDClient per process. Never create one per request.
 */
// The observability plugin must be imported before anything it instruments.
import { LDObserve, Observability } from '@launchdarkly/observability-node';
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
const SERVER_CONTEXT_KEY = 'abc-analytics-api';

export const serverContext: LDContext = {
  kind: 'user',
  key: SERVER_CONTEXT_KEY,
  name: 'ABC Analytics API (server)',
};

export const ldClient: LDClient = init(sdkKey, {
  // Streaming is the default and is what makes server-side "listeners" instant.
  // Shown here explicitly so it is obvious during the demo.
  stream: true,
  // LaunchDarkly Observability for the API: flag evaluations, logs, errors and
  // traces from this process show up in LaunchDarkly next to the browser's.
  // It authenticates with the SDK key above - no extra credentials.
  plugins: [new Observability({ serviceName: 'abc-analytics-api', serviceVersion: '1.0.0' })],
});

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Send a structured log to LaunchDarkly Observability, tagged with the flag so
 * it appears under the flag's Monitoring > Logs view (which only lists logs
 * carrying the feature_flag.* attributes). Also echoes to the console.
 */
export function logFlagEvent(
  message: string,
  level: LogLevel,
  attrs: { value: boolean; event: string; [extra: string]: string | number | boolean },
): void {
  const { value, event, ...extra } = attrs;
  const line = `[LaunchDarkly][${event}] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  LDObserve.recordLog(message, level, undefined, undefined, {
    'feature_flag.key': FLAG_KEYS.INSIGHTS_DASHBOARD,
    'feature_flag.result.value': String(value),
    'feature_flag.provider.name': 'LaunchDarkly',
    'feature_flag.context.id': SERVER_CONTEXT_KEY,
    event,
    source_tier: 'backend',
    ...extra,
  });
}

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
