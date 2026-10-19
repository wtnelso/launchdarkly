import { useLDClient, type LDContext } from '@launchdarkly/react-sdk';
import { useEffect, useState } from 'react';

/**
 * Identify the given context when the component mounts. Each scenario calls
 * this so the LaunchDarkly client always evaluates flags for the right visitor
 * (Part 1: the shared demo user; Part 2: the persona chosen in the drawer).
 */
export function useIdentify(context: LDContext): void {
  const client = useLDClient();
  useEffect(() => {
    void client.identify(context);
    // The context object is a stable module-level constant in both callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);
}

/** Display name of whoever the client is currently evaluating flags for. */
export function useCurrentContextName(): string {
  const client = useLDClient();
  const [name, setName] = useState(() => nameOf(client.getContext()));
  useEffect(() => client.onContextChange((ctx) => setName(nameOf(ctx))), [client]);
  return name;
}

function nameOf(ctx: unknown): string {
  if (!ctx || typeof ctx !== 'object') return 'Visitor';
  const c = ctx as Record<string, unknown>;
  const single = c.kind === 'multi' ? (c.user as Record<string, unknown> | undefined) : c;
  if (!single) return 'Visitor';
  if (single.anonymous === true) return 'Visitor';
  return typeof single.name === 'string' ? single.name : String(single.key ?? 'Visitor');
}
