/**
 * ABC Company billing API - a tiny Express server that shows the LaunchDarkly
 * Node.js server SDK alongside the React client SDK.
 *
 * Routes (all proxied from the Vite dev server under /api):
 *   GET  /api/health        - liveness + SDK initialization status
 *   GET  /api/pricing       - flag-dependent pricing data
 *   GET  /api/flag-events   - SSE stream of server-side flag changes (the listener)
 *   POST /api/report-error  - optional automatic kill switch via flag trigger
 */
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { ldClient, waitForLaunchDarkly } from './ld.js';
import { flagEventsRouter } from './routes/flagEvents.js';
import { pricingRouter } from './routes/pricing.js';
import { remediateRouter } from './routes/remediate.js';

// API_PORT (not the generic PORT) so hosting tools that inject PORT can't collide with Vite.
const port = Number(process.env.API_PORT ?? 3001);

const app = express();
app.use(cors()); // harmless locally; lets you hit the API from any origin while demoing
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, launchDarklyInitialized: ldClient.initialized() });
});
app.use('/api', pricingRouter);
app.use('/api', flagEventsRouter);
app.use('/api', remediateRouter);

async function main(): Promise<void> {
  await waitForLaunchDarkly();

  const server = app.listen(port, () => {
    console.log(`[Server] ABC billing API listening on http://localhost:${port}`);
  });

  // Graceful shutdown: flush analytics events, then close the SDK's stream.
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Server] ${signal} received - shutting down`);
    server.close();
    await ldClient.flush();
    ldClient.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
