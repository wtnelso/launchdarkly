/**
 * GET  /api/demo/chaos  -> { enabled }
 * POST /api/demo/chaos  { enabled: boolean }
 *
 * Driven by the Admin drawer's "Inject bad report data" control. Only the
 * Insights (flag ON) variant is affected; the legacy usage table never is.
 */
import { Router } from 'express';
import { demoState } from '../demo.js';

export const demoRouter = Router();

demoRouter.get('/demo/chaos', (_req, res) => {
  res.json({ enabled: demoState.chaos });
});

demoRouter.post('/demo/chaos', (req, res) => {
  const { enabled } = (req.body ?? {}) as { enabled?: boolean };
  demoState.chaos = Boolean(enabled);
  console.warn(`[Demo] chaos mode ${demoState.chaos ? 'ON - Insights payload will be malformed' : 'off'}`);
  res.json({ enabled: demoState.chaos });
});
