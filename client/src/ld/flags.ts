export const FLAG_KEYS = {
  // REPLACE ME: Boolean flag to create in LaunchDarkly (Part 1). Must have "Available on client-side SDKs" enabled.
  // Change the key here (and in server/src/ld.ts) if you named it differently.
  INSIGHTS_DASHBOARD: 'insights-dashboard',
  // REPLACE ME: Boolean flag to create in LaunchDarkly (Parts 2 and 3). Must have "Available on client-side SDKs" enabled.
  // Change the key here (and in server/src/ld.ts) if you named it differently.
  LANDING_HERO_V2: 'landing-hero-v-2',
  // REPLACE ME: AI Config key to create in LaunchDarkly (Part 4). Change the key here (and in server/src/ld.ts) if you named it differently.
  SUPPORT_ASSISTANT: 'support-assistant',
} as const;

export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];
