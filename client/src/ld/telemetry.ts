import { LDObserve } from '@launchdarkly/observability';
import { FLAG_KEYS } from './flags';
import { clientSideId, DEMO_CONTEXT_KEY, getLDClient } from './provider';

type Level = 'debug' | 'info' | 'warn' | 'error';

interface FlagEventAttrs {
  /** The flag value in effect when this happened. */
  value: boolean;
  /** Short machine-readable name: flag_change, chaos_on, crash, kill_switch... */
  event: string;
  [extra: string]: string | number | boolean;
}

/**
 * Send a structured log to LaunchDarkly Observability, associated with the flag.
 *
 * LaunchDarkly ties telemetry to a flag the same way its own plugins do: a span
 * that carries the `feature_flag.*` attributes (key, set id = environment,
 * context, value) and contains the flag evaluation. So each log is written
 * inside such a span, with the flag evaluated in it, which is what makes it
 * show up under the flag's Monitoring > Logs view rather than only on the
 * account-wide Logs page.
 */
export function logFlagEvent(message: string, level: Level, { value, event, ...extra }: FlagEventAttrs): void {
  const attributes = {
    'feature_flag.key': FLAG_KEYS.INSIGHTS_DASHBOARD,
    'feature_flag.set.id': clientSideId,
    'feature_flag.result.value': String(value),
    'feature_flag.provider.name': 'LaunchDarkly',
    'feature_flag.context.id': DEMO_CONTEXT_KEY,
    event,
    source_tier: 'browser',
    ...extra,
  };
  try {
    LDObserve.startSpan(`incident.${event}`, (span) => {
      span?.setAttributes(attributes);
      // Evaluate inside the span so the plugin's evaluation event lands in this trace.
      getLDClient().boolVariation(FLAG_KEYS.INSIGHTS_DASHBOARD, false);
      LDObserve.recordLog(message, level, attributes);
    });
  } catch (err) {
    console.warn('[LaunchDarkly] telemetry failed:', err);
  }
}
