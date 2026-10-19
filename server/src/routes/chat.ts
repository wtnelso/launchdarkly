/**
 * Part 4 (AI Config): the support assistant API.
 *
 *   POST /api/chat           { context, message }                  -> one reply + which config variation served it
 *   POST /api/chat/feedback  { context, resumptionToken, kind }    -> thumbs up/down for an earlier reply
 *   POST /api/chat/evaluate  { context }                           -> the served config and the evaluation reason (no reply)
 *
 * The browser sends the visitor's LaunchDarkly context (same personas as
 * Part 2); the AI Config is evaluated server-side with the SDK key.
 */
import { Router } from 'express';
import type { LDContext } from '@launchdarkly/node-server-sdk';
import { AI_CONFIG_KEY, recordFeedback, runSupportTurn, servedConfigFor } from '../ai/supportAssistant.js';
import { ldClient, logFlagEvent } from '../ld.js';

export const chatRouter = Router();

function isContext(value: unknown): value is LDContext {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && kind.length > 0;
}

chatRouter.post('/chat', async (req, res) => {
  const { context, message } = (req.body ?? {}) as { context?: unknown; message?: unknown };
  if (!isContext(context) || typeof message !== 'string' || message.trim().length === 0 || message.length > 500) {
    res.status(400).json({ error: 'Body must be { context: <LaunchDarkly context>, message: <1-500 chars> }' });
    return;
  }

  const turn = await runSupportTurn(context, message.trim());
  logFlagEvent(
    turn.enabled
      ? `Support reply served by variation ${turn.served.variationKey || 'fallback'} (${turn.served.model?.name ?? 'no model'}) in ${turn.metrics?.durationMs} ms`
      : 'Support assistant is turned off; no reply generated',
    'info',
    {
      flag: AI_CONFIG_KEY,
      event: 'chat_turn',
      value: turn.enabled,
      variation: turn.served.variationKey,
      model: turn.served.model?.name,
      durationMs: turn.metrics?.durationMs,
      tokens: turn.metrics?.tokens.total,
      style: turn.style,
    },
  );
  res.json({
    enabled: turn.enabled,
    served: turn.served,
    reply: turn.reply,
    style: turn.style,
    metrics: turn.metrics,
    resumptionToken: turn.resumptionToken,
    generatedAt: new Date().toISOString(),
  });
});

chatRouter.post('/chat/feedback', (req, res) => {
  const { context, resumptionToken, kind } = (req.body ?? {}) as { context?: unknown; resumptionToken?: unknown; kind?: unknown };
  if (!isContext(context) || typeof resumptionToken !== 'string' || (kind !== 'positive' && kind !== 'negative')) {
    res.status(400).json({ error: "Body must be { context, resumptionToken, kind: 'positive' | 'negative' }" });
    return;
  }
  try {
    const track = recordFeedback(context, resumptionToken, kind);
    logFlagEvent(`Customer rated a reply from variation ${track.variationKey}: ${kind}`, 'info', {
      flag: AI_CONFIG_KEY,
      event: 'chat_feedback',
      value: true,
      variation: track.variationKey,
      kind,
    });
    res.json({ ok: true, track });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid resumption token' });
  }
});

chatRouter.post('/chat/evaluate', async (req, res) => {
  const { context } = (req.body ?? {}) as { context?: unknown };
  if (!isContext(context)) {
    res.status(400).json({ error: 'Body must be { context: <LaunchDarkly context> }' });
    return;
  }
  const [{ served }, detail] = await Promise.all([servedConfigFor(context), ldClient.jsonVariationDetail(AI_CONFIG_KEY, context, null)]);
  res.json({ served, reason: detail.reason, evaluatedAt: new Date().toISOString() });
});
