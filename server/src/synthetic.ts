import type { LDContext } from '@launchdarkly/node-server-sdk';

/**
 * Random visitors for the Part 3 bulk traffic simulation (POST /api/demo/simulate-traffic).
 * Same shape as the browser's client/src/scenarios/part3/syntheticVisitors.ts:
 * a user + organization multi-context with a fresh user key, no beta testers and
 * no enterprise plans, so every visitor falls through to the experiment's rule.
 */
const FIRST = ['Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Ethan', 'Priya', 'Mateo', 'Yuki', 'Omar', 'Lena', 'Kai'];
const LAST = ['Patel', 'Nguyen', 'Schmidt', 'Okafor', 'Rossi', 'Tanaka', 'Dubois', 'Silva', 'Kowalski', 'Haddad'];
const COUNTRIES = ['US', 'US', 'US', 'CA', 'GB', 'DE', 'FR', 'AU', 'BR', 'IN'];
const ROLES = ['developer', 'analyst', 'manager', 'founder', 'marketer'];
const PLANS = ['free', 'free', 'free', 'pro'];
const INDUSTRIES = ['software', 'retail', 'fintech', 'media', 'education', 'logistics'];
const ORG_WORDS = ['Blue', 'Summit', 'Pine', 'Delta', 'Quartz', 'Harbor', 'Atlas', 'Nimbus', 'Copper', 'Vega'];
const ORG_SUFFIX = ['Labs', 'Works', 'Systems', 'Digital', 'Studio', 'Analytics'];

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const id = () => Math.random().toString(36).slice(2, 8);

export function randomVisitor(): LDContext {
  const first = pick(FIRST);
  const last = pick(LAST);
  const orgWord = pick(ORG_WORDS);
  return {
    kind: 'multi',
    user: {
      key: `sim-${first.toLowerCase()}-${id()}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}@${orgWord.toLowerCase()}.example`,
      country: pick(COUNTRIES),
      role: pick(ROLES),
      betaTester: false,
      synthetic: true,
    },
    organization: {
      key: `sim-org-${orgWord.toLowerCase()}-${id()}`,
      name: `${orgWord} ${pick(ORG_SUFFIX)}`,
      plan: pick(PLANS),
      industry: pick(INDUSTRIES),
      employees: 5 + Math.floor(Math.random() * 400),
      synthetic: true,
    },
  };
}

/** Roughly bell-shaped milliseconds-to-click: v2 visitors decide a little faster. */
export function randomTimeToClick(hero: 'v2' | 'classic'): number {
  const base = hero === 'v2' ? 5500 : 8500;
  const spread = hero === 'v2' ? 3000 : 4500;
  const noise = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
  return Math.max(800, Math.round(base + noise * 2 * spread));
}
