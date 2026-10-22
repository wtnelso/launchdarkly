import { Router } from 'express';
import { demoState } from '../demo.js';
import { AI_CONFIG_KEY, runSupportTurn } from '../ai/supportAssistant.js';
import { FLAG_KEYS, METRIC_EVENTS, ldClient, logFlagEvent } from '../ld.js';
import { randomTimeToClick, randomVisitor } from '../synthetic.js';
import { LDFeedbackKind } from '@launchdarkly/server-sdk-ai';

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
    const v2 = await ldClient.boolVariation(FLAG_KEYS.LANDING_HERO_V2, visitor, false);
    const hero = v2 ? 'v2' : 'classic';
    stats[hero].exposures += 1;
    if (Math.random() < (v2 ? convV2 : convClassic)) {
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

const QUESTIONS = [
  'Where is my invoice?',
  'I forgot my password',
  'What is my API rate limit?',
  'How do I export a report to CSV?',
  'I want to downgrade my plan',
  'Hi, what can you help with?',
];

demoRouter.post('/demo/simulate-chats', async (req, res) => {
  const body = (req.body ?? {}) as { conversations?: unknown; turns?: unknown; positiveConcise?: unknown; positiveFriendly?: unknown };
  const conversations = Math.round(clamp(body.conversations, 1, 2000, 300));
  const turns = Math.round(clamp(body.turns, 1, 5, 2));
  const positive = { concise: clamp(body.positiveConcise, 0, 1, 0.55), friendly: clamp(body.positiveFriendly, 0, 1, 0.8) };
  const startedAt = Date.now();

  type Stat = { variationKey: string; model: string; style: string; turns: number; positive: number; negative: number; totalMs: number; totalTokens: number };
  const byVariation = new Map<string, Stat>();
  let disabled = 0;

  for (let i = 0; i < conversations; i++) {
    const visitor = randomVisitor();
    for (let t = 0; t < turns; t++) {
      const question = QUESTIONS[(i + t) % QUESTIONS.length];
      const turn = await runSupportTurn(visitor, question, { simulate: true, seed: `${i}:${t}` });
      if (!turn.enabled || !turn.tracker || !turn.metrics || !turn.style) {
        disabled += 1;
        continue;
      }
      const key = turn.served.variationKey || 'fallback';
      const stat =
        byVariation.get(key) ??
        { variationKey: key, model: turn.served.model?.name ?? '?', style: turn.style, turns: 0, positive: 0, negative: 0, totalMs: 0, totalTokens: 0 };
      stat.turns += 1;
      stat.totalMs += turn.metrics.durationMs;
      stat.totalTokens += turn.metrics.tokens.total;
      const thumbsUp = Math.random() < positive[turn.style];
      turn.tracker.trackFeedback({ kind: thumbsUp ? LDFeedbackKind.Positive : LDFeedbackKind.Negative });
      if (thumbsUp) stat.positive += 1;
      else stat.negative += 1;
      byVariation.set(key, stat);
    }
  }
  await ldClient.flush();

  const stats = [...byVariation.values()].map((s) => ({
    ...s,
    positiveRate: s.turns ? s.positive / s.turns : 0,
    avgMs: s.turns ? Math.round(s.totalMs / s.turns) : 0,
    avgTokens: s.turns ? Math.round(s.totalTokens / s.turns) : 0,
  }));
  const elapsedMs = Date.now() - startedAt;
  logFlagEvent(
    `Simulated ${conversations} support conversations (${turns} turns each): ` +
      stats.map((s) => `${s.variationKey} ${Math.round(s.positiveRate * 100)}% positive over ${s.turns} turns`).join(', '),
    'info',
    { flag: AI_CONFIG_KEY, event: 'chat_simulation', value: disabled === 0, conversations, turns, disabled },
  );
  res.json({ conversations, turns, disabled, byVariation: stats, elapsedMs, flushed: true });
});

demoRouter.post('/demo/simulate-reports', async (req, res) => {
  const body = (req.body ?? {}) as { visitors?: unknown };
  const visitors = Math.round(clamp(body.visitors, 1, 5000, 300));
  const stats = { legacy: { views: 0 }, insights: { views: 0, crashes: 0 } };
  const startedAt = Date.now();

  for (let i = 0; i < visitors; i++) {
    const visitor = randomVisitor();
    const insights = await ldClient.boolVariation(FLAG_KEYS.INSIGHTS_DASHBOARD, visitor, false);
    if (!insights) {
      stats.legacy.views += 1;
      continue;
    }
    stats.insights.views += 1;
    if (demoState.chaos) {
      ldClient.track(METRIC_EVENTS.INSIGHTS_CRASH, visitor, { message: "Cannot read properties of null (reading 'map')", synthetic: true });
      stats.insights.crashes += 1;
    }
  }
  await ldClient.flush();

  const elapsedMs = Date.now() - startedAt;
  logFlagEvent(
    `Simulated ${visitors} report visitors: ${stats.legacy.views} legacy, ${stats.insights.views} Insights, ${stats.insights.crashes} crashes` +
      (demoState.chaos ? ' (chaos on)' : ''),
    stats.insights.crashes > 0 ? 'warn' : 'info',
    { event: 'report_simulation', value: stats.insights.views > 0, visitors, chaos: demoState.chaos, crashes: stats.insights.crashes },
  );
  res.json({ visitors, chaos: demoState.chaos, ...stats, elapsedMs, flushed: true });
});
