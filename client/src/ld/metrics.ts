import { useSyncExternalStore } from 'react';
import { getLDClient } from './provider';

// REPLACE ME: metric event keys. Create metrics with these event keys in LaunchDarkly (Metrics > Create metric > Event key)
// or change them here to match yours. Keep in sync with server/src/ld.ts.
export const METRIC_EVENTS = {
  HERO_CTA_CLICK: 'hero-cta-click',
  HERO_CTA_TIME_TO_CLICK: 'hero-cta-time-to-click',
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

export function trackHeroCtaClick(hero: 'v2' | 'classic', cta: string, msToClick: number): void {
  const client = getLDClient();
  client.track(METRIC_EVENTS.HERO_CTA_CLICK, { hero, cta });
  client.track(METRIC_EVENTS.HERO_CTA_TIME_TO_CLICK, { hero, cta }, msToClick);
  log = [{ at: new Date().toISOString(), contextKey: contextKeyOf(client.getContext()), hero, cta, msToClick }, ...log].slice(0, 30);
  notify();
}

export function trackSyntheticConversion(hero: 'v2' | 'classic', msToClick: number): void {
  const client = getLDClient();
  client.track(METRIC_EVENTS.HERO_CTA_CLICK, { hero, cta: 'primary', synthetic: true });
  client.track(METRIC_EVENTS.HERO_CTA_TIME_TO_CLICK, { hero, synthetic: true }, msToClick);
}

export function trackInsightsCrash(message: string): void {
  getLDClient().track(METRIC_EVENTS.INSIGHTS_CRASH, { message });
}
