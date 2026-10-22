import { LDObserve } from '@launchdarkly/observability';
import { FLAG_KEYS, type FlagKey } from './flags';
import { clientSideId, DEMO_CONTEXT_KEY, getLDClient } from './provider';

type Level = 'debug' | 'info' | 'warn' | 'error';

interface FlagEventAttrs {
  value: boolean;
  event: string;
  flag?: FlagKey;
  [extra: string]: string | number | boolean | undefined;
}

function flagAttributes({ value, event, flag = FLAG_KEYS.INSIGHTS_DASHBOARD, ...rest }: FlagEventAttrs): Record<string, string | number | boolean> {
  const extra: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) extra[k] = v;
  return {
    'feature_flag.key': flag,
    'feature_flag.set.id': clientSideId,
    'feature_flag.result.value': String(value),
    'feature_flag.provider.name': 'LaunchDarkly',
    'feature_flag.context.id': DEMO_CONTEXT_KEY,
    event,
    source_tier: 'browser',
    ...extra,
  };
}

function withFlagSpan(name: string, attributes: Record<string, string | number | boolean>, fn: () => void): void {
  try {
    LDObserve.startSpan(name, (span) => {
      span?.setAttributes(attributes);
      getLDClient().boolVariation(String(attributes['feature_flag.key']), false);
      fn();
    });
  } catch (err) {
    console.warn('[LaunchDarkly] telemetry failed:', err);
  }
}

export function logFlagEvent(message: string, level: Level, attrs: FlagEventAttrs): void {
  const attributes = flagAttributes(attrs);
  withFlagSpan(`incident.${attrs.event}`, attributes, () => LDObserve.recordLog(message, level, attributes));
}

export function recordFlagError(error: Error, message: string, attrs: FlagEventAttrs): void {
  const attributes = flagAttributes(attrs);
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(attributes)) payload[k] = String(v);
  withFlagSpan(`incident.${attrs.event}`, attributes, () => LDObserve.recordError(error, message, payload));
}
