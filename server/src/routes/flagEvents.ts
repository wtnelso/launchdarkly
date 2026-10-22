import { Router, type Response } from 'express';
import { demoState } from '../demo.js';
import { FLAG_KEYS, isNewReportingOn, ldClient, logFlagEvent } from '../ld.js';

interface FlagEvent {
  key: string;
  value: boolean;
  at: string;
  reason: 'initial' | 'update';
  chaos: boolean;
}

const subscribers = new Set<Response>();
let lastValue: boolean | undefined;

function send(res: Response, event: FlagEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function broadcast(reason: FlagEvent['reason']): Promise<void> {
  const value = await isNewReportingOn();

  if (!value && demoState.chaos) {
    demoState.chaos = false;
    logFlagEvent('Chaos mode reset: the bad release was rolled back', 'info', { event: 'chaos_reset', value });
  }
  if (reason === 'update' && lastValue !== undefined && value !== lastValue) {
    logFlagEvent(`${FLAG_KEYS.INSIGHTS_DASHBOARD} changed to ${value} on the server`, 'info', {
      event: 'flag_change',
      value,
    });
  }
  lastValue = value;

  const event: FlagEvent = {
    key: FLAG_KEYS.INSIGHTS_DASHBOARD,
    value,
    at: new Date().toISOString(),
    reason,
    chaos: demoState.chaos,
  };
  console.log(`[LaunchDarkly] ${event.key} changed -> ${event.value} (notifying ${subscribers.size} browser(s))`);
  for (const res of subscribers) send(res, event);
}

ldClient.on(`update:${FLAG_KEYS.INSIGHTS_DASHBOARD}`, () => {
  void broadcast('update');
});

export const flagEventsRouter = Router();

flagEventsRouter.get('/flag-events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  subscribers.add(res);

  send(res, {
    key: FLAG_KEYS.INSIGHTS_DASHBOARD,
    value: await isNewReportingOn(),
    at: new Date().toISOString(),
    reason: 'initial',
    chaos: demoState.chaos,
  });

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    subscribers.delete(res);
  });
});
