import type { LDContext } from '@launchdarkly/react-sdk';

/**
 * Random visitors for the Part 3 traffic simulation.
 *
 * Each one is a multi-context like the Part 2 personas (user + organization)
 * with a fresh random user key, so LaunchDarkly's experiment buckets it on its
 * own: the experiment's randomization unit is the *user* context kind, and the
 * bucket is a hash of the user key, so a new key is a new coin flip.
 *
 * None of them match the Part 2 targeting (no beta testers, no enterprise
 * plans): a visitor served by an individual target or a rule is not in the
 * experiment, which only runs on the default rule. Every synthetic visitor is
 * tagged `synthetic: true` so they are easy to tell apart in Contexts.
 *
 * Keep in sync with server/src/synthetic.ts (same shape, used for bulk traffic).
 */
const FIRST = ['Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Ethan', 'Priya', 'Mateo', 'Yuki', 'Omar', 'Lena', 'Kai'];
const LAST = ['Patel', 'Nguyen', 'Schmidt', 'Okafor', 'Rossi', 'Tanaka', 'Dubois', 'Silva', 'Kowalski', 'Haddad'];
const COUNTRIES = ['US', 'US', 'US', 'CA', 'GB', 'DE', 'FR', 'AU', 'BR', 'IN'];
const ROLES = ['developer', 'analyst', 'manager', 'founder', 'marketer'];
const PLANS = ['free', 'free', 'free', 'pro'] as const;
const INDUSTRIES = ['software', 'retail', 'fintech', 'media', 'education', 'logistics'];
const ORG_WORDS = ['Blue', 'Summit', 'Pine', 'Delta', 'Quartz', 'Harbor', 'Atlas', 'Nimbus', 'Copper', 'Vega'];
const ORG_SUFFIX = ['Labs', 'Works', 'Systems', 'Digital', 'Studio', 'Analytics'];

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const id = () => Math.random().toString(36).slice(2, 8);

export function randomVisitor(): LDContext {
  const first = pick(FIRST);
  const last = pick(LAST);
  const key = `sim-${first.toLowerCase()}-${id()}`;
  const orgWord = pick(ORG_WORDS);
  return {
    kind: 'multi',
    user: {
      key,
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
  const noise = (Math.random() + Math.random() + Math.random()) / 3 - 0.5; // -0.5..0.5, centred
  return Math.max(800, Math.round(base + noise * 2 * spread));
}
