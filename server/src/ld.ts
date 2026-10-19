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
  /**
   * REPLACE ME if you named your flag differently.
   * Part 2: boolean flag around the landing-page hero. true = personalized
   * hero (v2), false = classic hero. Targeted by context attributes.
   */
  LANDING_HERO_V2: 'landing-hero-v-2',
} as const;

export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];

/**
 * Metric event keys for Experimentation (extra credit). Keep in sync with
 * client/src/ld/metrics.ts. REPLACE ME if you used different event keys when
 * creating the metrics in LaunchDarkly.
 */
export const METRIC_EVENTS = {
  /** Conversion (binary): the visitor clicked the hero's primary call to action. */
  HERO_CTA_CLICK: 'hero-cta-click',
  /** Numeric: milliseconds from hero render to click. Lower is better. */
  HERO_CTA_TIME_TO_CLICK: 'hero-cta-time-to-click',
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
 * Send a structured log to LaunchDarkly Observability, associated with the flag.
 *
 * LaunchDarkly ties telemetry to a flag through spans that carry the
 * `feature_flag.*` attributes and contain the evaluation. The observability
 * plugin's tracing hook adds the evaluation event to whichever span is active,
 * so we open a span, evaluate the flag inside it, and write the log there.
 * That is what makes the entry appear under the flag's Monitoring > Logs view.
 * Also echoes to the console.
 */
export function logFlagEvent(
  message: string,
  level: LogLevel,
  attrs: { value: boolean; event: string; flag?: FlagKey; [extra: string]: string | number | boolean | undefined },
): void {
  const { value, event, flag = FLAG_KEYS.INSIGHTS_DASHBOARD, ...rest } = attrs;
  const extra: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) extra[k] = v;
  const line = `[LaunchDarkly][${event}] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  const attributes: Record<string, string | number | boolean> = {
    'feature_flag.key': flag,
    'feature_flag.result.value': String(value),
    'feature_flag.provider.name': 'LaunchDarkly',
    'feature_flag.context.id': SERVER_CONTEXT_KEY,
    event,
    source_tier: 'backend',
    ...extra,
  };
  // OPTIONAL: LD_ENVIRONMENT_ID (= the environment's client-side ID) lets the
  // log carry feature_flag.set.id like the plugins' own evaluation events do.
  if (process.env.LD_ENVIRONMENT_ID) attributes['feature_flag.set.id'] = process.env.LD_ENVIRONMENT_ID;

  void LDObserve.runWithHeaders(`incident.${event}`, {}, async (span) => {
    span.setAttributes(attributes);
    await ldClient.boolVariation(flag, serverContext, false);
    LDObserve.recordLog(message, level, undefined, undefined, attributes);
  }).catch((err: unknown) => console.warn('[LaunchDarkly] telemetry failed:', err));
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
