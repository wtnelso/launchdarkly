/**
 * GET /api/flag-events  (Server-Sent Events)
 *
 * Demonstrates the *server-side* flag listener. The Node SDK emits
 * `update:<flag-key>` whenever that flag changes in LaunchDarkly. We
 * re-evaluate the flag and push the new value to every connected browser so
 * the dashboard can show "the server saw the change too" - without any
 * polling or page reload.
 */
import { Router, type Response } from 'express';
import { demoState } from '../demo.js';
import { FLAG_KEYS, isNewReportingOn, ldClient } from '../ld.js';

interface FlagEvent {
  key: string;
  value: boolean;
  at: string;
  /** 'initial' when sent on connect, 'update' when LaunchDarkly pushed a change. */
  reason: 'initial' | 'update';
  /** Demo: is the API currently returning malformed Insights data? */
  chaos: boolean;
}

const subscribers = new Set<Response>();

function send(res: Response, event: FlagEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function broadcast(reason: FlagEvent['reason']): Promise<void> {
  const value = await isNewReportingOn();

  // Rolling the release back also retires the bad data that came with it, so
  // the next release renders healthy.
  if (!value && demoState.chaos) {
    demoState.chaos = false;
    console.log('[Demo] chaos mode reset - the bad release was rolled back');
  }

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

// --- The listener -----------------------------------------------------------
// Registered once for the life of the process. The event payload does not
// include the new value, so we call variation() inside the handler.
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

  // Tell the new subscriber the current value right away.
  send(res, {
    key: FLAG_KEYS.INSIGHTS_DASHBOARD,
    value: await isNewReportingOn(),
    at: new Date().toISOString(),
    reason: 'initial',
    chaos: demoState.chaos,
  });

  // Keep proxies from closing an idle connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    subscribers.delete(res);
  });
});
