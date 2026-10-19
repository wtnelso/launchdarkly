/**
 * GET  /api/demo/chaos  -> { enabled }
 * POST /api/demo/chaos  { enabled: boolean }
 *
 * Driven by the Admin drawer's "Inject bad report data" control. Only the
 * Insights (flag ON) variant is affected; the legacy usage table never is.
 *
 * POST /api/demo/simulate-traffic { visitors, convClassic, convV2 }
 *
 * Part 3 (Experimentation): bulk synthetic traffic from the server SDK. The
 * Node SDK evaluates flags locally, so thousands of visitors take well under a
 * second; the exposures and conversions are batched and flushed to LaunchDarkly.
 */
import { Router } from 'express';
import { demoState } from '../demo.js';
import { FLAG_KEYS, METRIC_EVENTS, ldClient, logFlagEvent } from '../ld.js';
import { randomTimeToClick, randomVisitor } from '../synthetic.js';

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

const clamp = (n: unknown, lo: number, hi: number, fallback: number): number => {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, x));
};

demoRouter.post('/demo/simulate-traffic', async (req, res) => {
  const body = (req.body ?? {}) as { visitors?: unknown; convClassic?: unknown; convV2?: unknown };
  const visitors = Math.round(clamp(body.visitors, 1, 5000, 500));
  const convClassic = clamp(body.convClassic, 0, 1, 0.2);
  const convV2 = clamp(body.convV2, 0, 1, 0.32);
  const stats = { classic: { exposures: 0, conversions: 0 }, v2: { exposures: 0, conversions: 0 } };
  const startedAt = Date.now();

  for (let i = 0; i < visitors; i++) {
    const visitor = randomVisitor();
    // The exposure. With an experiment running on the default rule, the SDK's
    // feature event carries the variation the visitor was bucketed into.
    const v2 = await ldClient.boolVariation(FLAG_KEYS.LANDING_HERO_V2, visitor, false);
    const hero = v2 ? 'v2' : 'classic';
    stats[hero].exposures += 1;
    if (Math.random() < (v2 ? convV2 : convClassic)) {
      // The conversion, for the same context so LaunchDarkly can attribute it.
      ldClient.track(METRIC_EVENTS.HERO_CTA_CLICK, visitor, { hero, cta: 'primary', synthetic: true });
      ldClient.track(METRIC_EVENTS.HERO_CTA_TIME_TO_CLICK, visitor, { hero, synthetic: true }, randomTimeToClick(hero));
      stats[hero].conversions += 1;
    }
  }
  await ldClient.flush();

  const elapsedMs = Date.now() - startedAt;
  logFlagEvent(
    `Simulated ${visitors} visitors on the API: classic ${stats.classic.conversions}/${stats.classic.exposures}, v2 ${stats.v2.conversions}/${stats.v2.exposures} conversions`,
    'info',
    {
      flag: FLAG_KEYS.LANDING_HERO_V2,
      event: 'traffic_simulation',
      value: true,
      visitors,
      classic_exposures: stats.classic.exposures,
      classic_conversions: stats.classic.conversions,
      v2_exposures: stats.v2.exposures,
      v2_conversions: stats.v2.conversions,
    },
  );
  res.json({ visitors, ...stats, elapsedMs, flushed: true });
});
