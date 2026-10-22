import { Router } from 'express';
import { FLAG_KEYS, logFlagEvent } from '../ld.js';

export const remediateRouter = Router();

remediateRouter.post('/report-error', async (req, res) => {
  const { flag, message } = (req.body ?? {}) as { flag?: string; message?: string };
  console.warn(`[Remediate] Client reported an error in feature "${flag}": ${message}`);
  logFlagEvent(`Client reported a crash in the Insights dashboard: ${message ?? 'unknown error'}`, 'error', {
    event: 'crash_report',
    value: true,
  });

  if (flag !== FLAG_KEYS.INSIGHTS_DASHBOARD) {
    res.status(400).json({ remediated: false, reason: `Unknown flag "${flag}"` });
    return;
  }

  // REPLACE ME: LD_TRIGGER_URL in server/.env is the flag trigger URL created on insights-dashboard (action: Turn flag off).
  const triggerUrl = process.env.LD_TRIGGER_URL;
  if (!triggerUrl) {
    logFlagEvent('No flag trigger configured (LD_TRIGGER_URL unset); manual remediation required', 'warn', {
      event: 'trigger_missing',
      value: true,
    });
    res.json({
      remediated: false,
      reason: 'LD_TRIGGER_URL is not set, so no automatic kill switch. Run `npm run remediate` or toggle the flag off in LaunchDarkly.',
    });
    return;
  }

  try {
    const ldResponse = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: `Automatic kill switch: Insights dashboard crashed (${message ?? 'unknown error'})`,
        url: 'http://localhost:5173',
      }),
    });

    console.log(`[Remediate] Fired flag trigger -> HTTP ${ldResponse.status}`);
    logFlagEvent(`Flag trigger fired to turn ${FLAG_KEYS.INSIGHTS_DASHBOARD} off (HTTP ${ldResponse.status})`, 'warn', {
      event: 'trigger_fired',
      value: true,
      trigger_status: ldResponse.status,
    });
    res.json({ remediated: ldResponse.ok, triggerStatus: ldResponse.status });
  } catch (err) {
    console.error('[Remediate] Failed to call flag trigger:', err);
    res.status(502).json({ remediated: false, reason: 'Could not reach the LaunchDarkly trigger URL' });
  }
});
