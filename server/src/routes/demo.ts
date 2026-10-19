/**
 * GET  /api/demo/chaos  -> { enabled }
 * POST /api/demo/chaos  { enabled: boolean }
 *
 * Driven by the Admin drawer's "Inject bad report data" control. Only the
 * Insights (flag ON) variant is affected; the legacy usage table never is.
 */
import { Router } from 'express';
import { demoState } from '../demo.js';
import { logFlagEvent } from '../ld.js';

export const demoRouter = Router();

demoRouter.get('/demo/chaos', (_req, res) => {
  res.json({ enabled: demoState.chaos });
});

demoRouter.post('/demo/chaos', (req, res) => {
  const { enabled } = (req.body ?? {}) as { enabled?: boolean };
  demoState.chaos = Boolean(enabled);
  logFlagEvent(
    demoState.chaos ? 'Chaos mode on: Insights payload will be malformed (series: null)' : 'Chaos mode off',
    demoState.chaos ? 'warn' : 'info',
    { event: demoState.chaos ? 'chaos_on' : 'chaos_off', value: true },
  );
  res.json({ enabled: demoState.chaos });
});
