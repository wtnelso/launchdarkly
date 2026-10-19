/**
 * ABC Company analytics API - a tiny Express server that shows the LaunchDarkly
 * Node.js server SDK alongside the React client SDK.
 *
 * Routes (all proxied from the Vite dev server under /api):
 *   GET  /api/health        - liveness + SDK initialization status
 *   GET  /api/reports/usage - flag-dependent usage report (legacy table vs Insights)
 *   GET  /api/flag-events   - SSE stream of server-side flag changes (the listener)
 *   POST /api/report-error  - optional automatic kill switch via flag trigger
 *   GET/POST /api/demo/chaos - demo only: make the Insights payload malformed
 *   POST /api/landing/evaluate - Part 2: evaluate landing-hero-v-2 for a visitor context
 */
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { ldClient, waitForLaunchDarkly } from './ld.js';
import { demoRouter } from './routes/demo.js';
import { flagEventsRouter } from './routes/flagEvents.js';
import { landingRouter } from './routes/landing.js';
import { reportsRouter } from './routes/reports.js';
import { remediateRouter } from './routes/remediate.js';

// API_PORT (not the generic PORT) so hosting tools that inject PORT can't collide with Vite.
const port = Number(process.env.API_PORT ?? 3001);

const app = express();
app.use(cors()); // harmless locally; lets you hit the API from any origin while demoing
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, launchDarklyInitialized: ldClient.initialized() });
});
app.use('/api', reportsRouter);
app.use('/api', flagEventsRouter);
app.use('/api', remediateRouter);
app.use('/api', demoRouter);
app.use('/api', landingRouter);

async function main(): Promise<void> {
  await waitForLaunchDarkly();

  const server = app.listen(port, () => {
    console.log(`[Server] ABC analytics API listening on http://localhost:${port}`);
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
