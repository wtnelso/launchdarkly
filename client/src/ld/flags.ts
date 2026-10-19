/**
 * Feature flag keys used by the dashboard.
 *
 * Keep this in sync with server/src/ld.ts. If you recreate the flag in your own
 * LaunchDarkly project under a different key, change it here (and there).
 */
export const FLAG_KEYS = {
  /**
   * REPLACE ME if you named your flag differently.
   * Boolean flag. true = release the new Insights reporting dashboard,
   * false = today's plain usage report table.
   * Must have "Available on client-side SDKs" enabled in LaunchDarkly or the
   * React SDK will never see it and will always return the default (false).
   */
  INSIGHTS_DASHBOARD: 'insights-dashboard',
  /**
   * REPLACE ME if you named your flag differently.
   * Part 2: boolean flag around the landing-page hero. true = personalized hero
   * (v2), false = classic hero. Targeted in LaunchDarkly by context attributes
   * (individual targets + rules). Must be available to client-side SDKs.
   */
  LANDING_HERO_V2: 'landing-hero-v-2',
} as const;

export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];
