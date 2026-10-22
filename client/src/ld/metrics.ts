import { useSyncExternalStore } from 'react';
import { getLDClient } from './provider';

/**
 * Metric event keys for LaunchDarkly Experimentation.
 *
 * A metric in LaunchDarkly is defined by an *event key*; the SDK sends an
 * event with that key via `client.track()` and LaunchDarkly counts it for
 * whichever experiment variation the context was exposed to.
 *
 * REPLACE ME if you give the metric a different event key in LaunchDarkly
 * (Metrics > Create metric > Event key). Keep in sync with server/src/ld.ts.
 */
export const METRIC_EVENTS = {
  /** Conversion (binary): the visitor clicked the hero's primary call to action. */
  HERO_CTA_CLICK: 'hero-cta-click',
  /** Numeric (optional): milliseconds between the hero rendering and the click. Lower is better. */
  HERO_CTA_TIME_TO_CLICK: 'hero-cta-time-to-click',
  /**
   * Part 1 guarded rollout: the Insights dashboard crashed for this context.
   * Occurrence metric, lower is better. LaunchDarkly compares it between the
   * new variation and control during a guarded rollout and rolls back on its
   * own when the new variation regresses.
   */
  INSIGHTS_CRASH: 'insights-dashboard-crash',
} as const;

export interface ConversionEntry {
  at: string;
  contextKey: string;
  hero: 'v2' | 'classic';
  cta: string;
  msToClick: number;
}

const listeners = new Set<() => void>();
let log: ConversionEntry[] = [];

function notify(): void {
  for (const l of listeners) l();
}

/** Conversions tracked from this browser (for the Part 3 Admin panel). */
export function useConversionLog(): ConversionEntry[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => log,
  );
}

function contextKeyOf(ctx: unknown): string {
  if (!ctx || typeof ctx !== 'object') return '?';
  const c = ctx as Record<string, unknown>;
  const single = c.kind === 'multi' ? (c.user as Record<string, unknown> | undefined) : c;
  return String(single?.key ?? '?');
}

/**
 * Record a hero conversion for the *current* context.
 *
 * Two `track()` calls, two metrics:
 *  - `hero-cta-click`: a conversion metric. LaunchDarkly only needs the event
 *    key; the data object is free-form and shows up in the event's payload.
 *  - `hero-cta-time-to-click`: a numeric metric. The third argument is the
 *    metric value LaunchDarkly averages per variation.
 *
 * The experiment attributes the conversion to whichever variation this context
 * was served (the exposure is the `useBoolVariation` evaluation that rendered
 * the hero), so nothing here needs to know which hero was shown.
 */
export function trackHeroCtaClick(hero: 'v2' | 'classic', cta: string, msToClick: number): void {
  const client = getLDClient();
  client.track(METRIC_EVENTS.HERO_CTA_CLICK, { hero, cta });
  client.track(METRIC_EVENTS.HERO_CTA_TIME_TO_CLICK, { hero, cta }, msToClick);
  log = [{ at: new Date().toISOString(), contextKey: contextKeyOf(client.getContext()), hero, cta, msToClick }, ...log].slice(0, 30);
  notify();
}

/**
 * Same two events for a synthetic visitor (Part 3 traffic simulation). The
 * simulator has already called identify() for that visitor, so the events are
 * attributed to it; they are flagged `synthetic` in the payload.
 */
export function trackSyntheticConversion(hero: 'v2' | 'classic', msToClick: number): void {
  const client = getLDClient();
  client.track(METRIC_EVENTS.HERO_CTA_CLICK, { hero, cta: 'primary', synthetic: true });
  client.track(METRIC_EVENTS.HERO_CTA_TIME_TO_CLICK, { hero, synthetic: true }, msToClick);
}

/** Part 1: tell LaunchDarkly the new dashboard crashed for the current context (guarded-rollout signal). */
export function trackInsightsCrash(message: string): void {
  getLDClient().track(METRIC_EVENTS.INSIGHTS_CRASH, { message });
}
