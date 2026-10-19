/**
 * POST /api/report-error
 *
 * The React error boundary around the Insights dashboard calls this when the
 * feature crashes in a user's browser. If a LaunchDarkly *flag trigger* URL
 * is configured, the server fires it, which turns the flag OFF in
 * LaunchDarkly. Every connected client then rolls back to the legacy panel
 * within about a second - an automatic kill switch.
 *
 * This is optional. The graded remediation path is the manual one:
 * `npm run remediate` (scripts/remediate.sh) which POSTs the same trigger
 * URL with curl. Both exist so the demo can show "a human on call" and
 * "an automated monitor" using the identical mechanism.
 */
import { Router } from 'express';
import { FLAG_KEYS } from '../ld.js';

export const remediateRouter = Router();

remediateRouter.post('/report-error', async (req, res) => {
  const { flag, message } = (req.body ?? {}) as { flag?: string; message?: string };
  console.warn(`[Remediate] Client reported an error in feature "${flag}": ${message}`);

  if (flag !== FLAG_KEYS.INSIGHTS_DASHBOARD) {
    res.status(400).json({ remediated: false, reason: `Unknown flag "${flag}"` });
    return;
  }

  // REPLACE ME (optional): LD_TRIGGER_URL lives in server/.env - see server/.env.example
  const triggerUrl = process.env.LD_TRIGGER_URL;
  if (!triggerUrl) {
    res.json({
      remediated: false,
      reason: 'LD_TRIGGER_URL is not set, so no automatic kill switch. Run `npm run remediate` or toggle the flag off in LaunchDarkly.',
    });
    return;
  }

  try {
    // Generic triggers accept an optional JSON body. Both fields are optional
    // and show up in the flag's change history as the reason for the change.
    const ldResponse = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: `Automatic kill switch: ${message ?? 'error in Insights dashboard'}`,
        url: 'http://localhost:5173',
      }),
    });

    console.log(`[Remediate] Fired flag trigger -> HTTP ${ldResponse.status}`);
    res.json({ remediated: ldResponse.ok, triggerStatus: ldResponse.status });
  } catch (err) {
    console.error('[Remediate] Failed to call flag trigger:', err);
    res.status(502).json({ remediated: false, reason: 'Could not reach the LaunchDarkly trigger URL' });
  }
});
