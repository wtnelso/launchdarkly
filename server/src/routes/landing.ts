/**
 * POST /api/landing/evaluate   body: { context: LDContext }
 *
 * Part 2 (Target). The browser identifies a visitor with a multi-context
 * (user + organization). This endpoint evaluates the same flag for the same
 * context on the server and returns LaunchDarkly's evaluation *reason*, so the
 * Admin drawer can show that both tiers agree on who gets the new hero and why
 * (individual target, rule match, or the default rule).
 */
import { Router } from 'express';
import type { LDContext } from '@launchdarkly/node-server-sdk';
import { FLAG_KEYS, ldClient } from '../ld.js';

export const landingRouter = Router();

function isContext(value: unknown): value is LDContext {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && kind.length > 0;
}

landingRouter.post('/landing/evaluate', async (req, res) => {
  const { context } = (req.body ?? {}) as { context?: unknown };
  if (!isContext(context)) {
    res.status(400).json({ error: 'Body must be { context: <LaunchDarkly context> }' });
    return;
  }

  // variationDetail() returns the value plus why it was chosen. The server
  // SDK evaluates locally against its in-memory copy of the flag rules.
  const detail = await ldClient.boolVariationDetail(FLAG_KEYS.LANDING_HERO_V2, context, false);

  res.json({
    flag: FLAG_KEYS.LANDING_HERO_V2,
    value: detail.value,
    variationIndex: detail.variationIndex,
    reason: detail.reason,
    evaluatedAt: new Date().toISOString(),
  });
});
