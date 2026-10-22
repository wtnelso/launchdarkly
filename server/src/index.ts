import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { ldClient, waitForLaunchDarkly } from './ld.js';
import { chatRouter } from './routes/chat.js';
import { demoRouter } from './routes/demo.js';
import { flagEventsRouter } from './routes/flagEvents.js';
import { reportsRouter } from './routes/reports.js';
import { remediateRouter } from './routes/remediate.js';

const port = Number(process.env.API_PORT ?? 3001);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, launchDarklyInitialized: ldClient.initialized() });
});
app.use('/api', reportsRouter);
app.use('/api', flagEventsRouter);
app.use('/api', remediateRouter);
app.use('/api', demoRouter);
app.use('/api', chatRouter);

async function main(): Promise<void> {
  await waitForLaunchDarkly();

  const server = app.listen(port, () => {
    console.log(`[Server] ABC analytics API listening on http://localhost:${port}`);
  });

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
