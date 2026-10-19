import { LDObserve } from '@launchdarkly/observability';
import { FLAG_KEYS } from './flags';
import { DEMO_CONTEXT_KEY } from './provider';

type Level = 'debug' | 'info' | 'warn' | 'error';

interface FlagEventAttrs {
  /** The flag value in effect when this happened. */
  value: boolean;
  /** Short machine-readable name: flag_change, chaos_on, crash, kill_switch... */
  event: string;
  [extra: string]: string | number | boolean;
}

/**
 * Send a structured log to LaunchDarkly Observability, tagged with the flag.
 *
 * LaunchDarkly's flag-scoped views (flag > Monitoring > Logs) only list logs that
 * carry the `feature_flag.*` attributes, so every log we emit about the release
 * includes them. Plain console output is captured too, but without these tags it
 * only shows on the account-wide Logs page.
 */
export function logFlagEvent(message: string, level: Level, { value, event, ...extra }: FlagEventAttrs): void {
  LDObserve.recordLog(message, level, {
    'feature_flag.key': FLAG_KEYS.INSIGHTS_DASHBOARD,
    'feature_flag.result.value': String(value),
    'feature_flag.provider.name': 'LaunchDarkly',
    'feature_flag.context.id': DEMO_CONTEXT_KEY,
    event,
    source_tier: 'browser',
    ...extra,
  });
}
