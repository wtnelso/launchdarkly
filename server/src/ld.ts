import { LDObserve, Observability } from '@launchdarkly/observability-node';
import { init, type LDClient, type LDContext } from '@launchdarkly/node-server-sdk';

// REPLACE ME: LD_SDK_KEY in server/.env must be your LaunchDarkly server-side SDK key (sdk-...).
// Organization settings > Projects > your project > Environments > SDK key.
const sdkKey = process.env.LD_SDK_KEY;

if (!sdkKey) {
  console.error(
    '\n[LaunchDarkly] LD_SDK_KEY is not set.\n' +
      '  1. Copy server/.env.example to server/.env\n' +
      '  2. Paste your server-side SDK key from LaunchDarkly > Organization settings > Projects > Environments\n',
  );
  process.exit(1);
}

export const FLAG_KEYS = {
  // REPLACE ME: create a Boolean flag with this key in LaunchDarkly (Part 1). Change the key here if you named it differently.
  INSIGHTS_DASHBOARD: 'insights-dashboard',
  // REPLACE ME: create a Boolean flag with this key in LaunchDarkly (Parts 2 and 3). Change the key here if you named it differently.
  LANDING_HERO_V2: 'landing-hero-v-2',
  // REPLACE ME: create an AI Config with this key in LaunchDarkly (Part 4). Change the key here if you named it differently.
  SUPPORT_ASSISTANT: 'support-assistant',
} as const;

export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];

// REPLACE ME: metric event keys. Create metrics with these event keys in LaunchDarkly (Metrics > Create metric)
// or change them here to match yours. Keep in sync with client/src/ld/metrics.ts.
export const METRIC_EVENTS = {
  HERO_CTA_CLICK: 'hero-cta-click',
  HERO_CTA_TIME_TO_CLICK: 'hero-cta-time-to-click',
  INSIGHTS_CRASH: 'insights-dashboard-crash',
} as const;

const SERVER_CONTEXT_KEY = 'abc-analytics-api';

export const serverContext: LDContext = {
  kind: 'user',
  key: SERVER_CONTEXT_KEY,
  name: 'ABC Analytics API (server)',
};

export const ldClient: LDClient = init(sdkKey, {
  stream: true,
  plugins: [new Observability({ serviceName: 'abc-analytics-api', serviceVersion: '1.0.0' })],
});

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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
  if (process.env.LD_ENVIRONMENT_ID) attributes['feature_flag.set.id'] = process.env.LD_ENVIRONMENT_ID;

  void LDObserve.runWithHeaders(`incident.${event}`, {}, async (span) => {
    span.setAttributes(attributes);
    await ldClient.variation(flag, serverContext, false);
    LDObserve.recordLog(message, level, undefined, undefined, attributes);
  }).catch((err: unknown) => console.warn('[LaunchDarkly] telemetry failed:', err));
}

export async function waitForLaunchDarkly(): Promise<void> {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('[LaunchDarkly] Server SDK initialized - streaming flag updates');
  } catch (err) {
    console.error('[LaunchDarkly] Server SDK failed to initialize (check LD_SDK_KEY):', err);
  }
}

export function isNewReportingOn(): Promise<boolean> {
  return ldClient.boolVariation(FLAG_KEYS.INSIGHTS_DASHBOARD, serverContext, false);
}
