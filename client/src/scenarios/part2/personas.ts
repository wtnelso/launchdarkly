import type { LDContext } from '@launchdarkly/react-sdk';

// REPLACE ME: the Part 2 targeting in LaunchDarkly matches on these keys and attributes
// (individual target alice-chen; rules on user.betaTester and organization.plan). Keep them in sync.
export interface Persona {
  id: string;
  label: string;
  servedBy: string;
  expectedV2: boolean;
  user: { key: string; name?: string; email?: string; country: string; role?: string; betaTester: boolean; anonymous?: boolean };
  organization?: { key: string; name: string; plan: 'free' | 'pro' | 'enterprise'; industry: string; employees: number };
}

export const PERSONAS: Persona[] = [
  {
    id: 'alice',
    label: 'Alice Chen',
    servedBy: 'Individual target on user key alice-chen',
    expectedV2: true,
    user: { key: 'alice-chen', name: 'Alice Chen', email: 'alice@northwind.example', country: 'US', role: 'admin', betaTester: false },
    organization: { key: 'northwind-robotics', name: 'Northwind Robotics', plan: 'pro', industry: 'manufacturing', employees: 2400 },
  },
  {
    id: 'carla',
    label: 'Carla Ruiz',
    servedBy: 'Rule 2: organization.plan is enterprise',
    expectedV2: true,
    user: { key: 'carla-ruiz', name: 'Carla Ruiz', email: 'carla@maplehealth.example', country: 'CA', role: 'manager', betaTester: false },
    organization: { key: 'maple-health', name: 'Maple Health', plan: 'enterprise', industry: 'healthcare', employees: 180 },
  },
  {
    id: 'bruno',
    label: 'Bruno Keller',
    servedBy: 'Rule 1: user.betaTester is true',
    expectedV2: true,
    user: { key: 'bruno-keller', name: 'Bruno Keller', email: 'bruno@keller.example', country: 'DE', role: 'analyst', betaTester: true },
    organization: { key: 'keller-gmbh', name: 'Keller GmbH', plan: 'free', industry: 'logistics', employees: 12 },
  },
  {
    id: 'visitor',
    label: 'Anonymous visitor',
    servedBy: 'Default rule (no target or rule matches)',
    expectedV2: false,
    user: { key: 'anon-visitor', country: 'US', betaTester: false, anonymous: true },
  },
];

export const DEFAULT_PERSONA_ID = 'visitor';

export function contextFor(persona: Persona): LDContext {
  const user = { kind: 'user' as const, ...persona.user };
  if (!persona.organization) return user;
  return {
    kind: 'multi',
    user: persona.user,
    organization: { ...persona.organization },
  };
}

export function findPersona(id: string | null | undefined): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS.find((p) => p.id === DEFAULT_PERSONA_ID)!;
}
