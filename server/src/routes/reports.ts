/**
 * GET /api/reports/usage
 *
 * Returns the usage report the dashboard renders. The *shape* of the response
 * depends on the same feature flag the React app evaluates, so the demo can
 * show the client and server agreeing in real time:
 *
 *   flag OFF -> "legacy" variant: the monthly usage table ABC Company has shipped for years
 *   flag ON  -> "new" variant: the Insights dashboard (KPIs with deltas, 30-day trend, team breakdown)
 *
 * Data is mocked but deterministic: the same numbers every call, so the demo
 * never surprises you.
 */
import { Router } from 'express';
import { demoState } from '../demo.js';
import { FLAG_KEYS, isNewReportingOn } from '../ld.js';

export interface MonthRow {
  month: string; // YYYY-MM
  activeUsers: number;
  apiCalls: number;
  storageGb: number;
}

export interface Kpi {
  id: string;
  label: string;
  value: number;
  unit: '' | 'GB' | 'ms';
  /** Percent change vs the previous 30 days. */
  deltaPct: number;
}

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  activeUsers: number;
  apiCalls: number;
}

export interface TeamUsage {
  team: string;
  apiCalls: number;
  sharePct: number;
}

/** Small seeded PRNG so "random-looking" data is identical on every request. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ANCHOR = new Date('2026-10-19T00:00:00Z'); // keep the demo's "today" stable

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDailySeries(days: number): SeriesPoint[] {
  const rand = mulberry32(42);
  const out: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(ANCHOR);
    d.setUTCDate(d.getUTCDate() - i);
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 0.55 : 1;
    const trend = 1 + (days - 1 - i) * 0.012; // gentle growth over the window
    out.push({
      date: isoDate(d),
      activeUsers: Math.round(1180 * weekend * trend + rand() * 90),
      apiCalls: Math.round(412_000 * weekend * trend + rand() * 28_000),
    });
  }
  return out;
}

const last60 = buildDailySeries(60);
const last30 = last60.slice(30);
const prev30 = last60.slice(0, 30);

function sum(points: SeriesPoint[], key: 'activeUsers' | 'apiCalls'): number {
  return points.reduce((acc, p) => acc + p[key], 0);
}
function pct(now: number, before: number): number {
  return Math.round(((now - before) / before) * 1000) / 10;
}

const legacyMonths: MonthRow[] = [
  { month: '2026-05', activeUsers: 9_840, apiCalls: 10_120_000, storageGb: 412 },
  { month: '2026-06', activeUsers: 10_210, apiCalls: 10_690_000, storageGb: 438 },
  { month: '2026-07', activeUsers: 10_560, apiCalls: 11_140_000, storageGb: 461 },
  { month: '2026-08', activeUsers: 11_020, apiCalls: 11_830_000, storageGb: 487 },
  { month: '2026-09', activeUsers: 11_690, apiCalls: 12_410_000, storageGb: 516 },
  { month: '2026-10', activeUsers: 12_310, apiCalls: 12_980_000, storageGb: 544 },
];

const kpis: Kpi[] = [
  {
    id: 'active-users',
    label: 'Active users (30d)',
    value: Math.round(sum(last30, 'activeUsers') / 30),
    unit: '',
    deltaPct: pct(sum(last30, 'activeUsers'), sum(prev30, 'activeUsers')),
  },
  {
    id: 'api-calls',
    label: 'API calls (30d)',
    value: sum(last30, 'apiCalls'),
    unit: '',
    deltaPct: pct(sum(last30, 'apiCalls'), sum(prev30, 'apiCalls')),
  },
  { id: 'storage', label: 'Storage used', value: 544, unit: 'GB', deltaPct: 5.4 },
  { id: 'p95', label: 'p95 latency', value: 212, unit: 'ms', deltaPct: -8.1 },
];

const byTeamRaw = [
  { team: 'Platform', apiCalls: 4_930_000 },
  { team: 'Growth', apiCalls: 3_120_000 },
  { team: 'Data', apiCalls: 2_480_000 },
  { team: 'Mobile', apiCalls: 1_610_000 },
  { team: 'Support', apiCalls: 840_000 },
];
const teamTotal = byTeamRaw.reduce((a, t) => a + t.apiCalls, 0);
const byTeam: TeamUsage[] = byTeamRaw.map((t) => ({ ...t, sharePct: Math.round((t.apiCalls / teamTotal) * 1000) / 10 }));

export const reportsRouter = Router();

reportsRouter.get('/reports/usage', async (_req, res) => {
  // Server-side evaluation. The SDK answers from its in-memory flag store,
  // so this is a local lookup - no network call per request.
  const newReporting = await isNewReportingOn();

  if (newReporting) {
    res.json({
      flag: FLAG_KEYS.INSIGHTS_DASHBOARD,
      variant: 'new',
      generatedAt: new Date().toISOString(),
      period: { from: last30[0].date, to: last30[last30.length - 1].date },
      kpis,
      // Chaos mode (Admin drawer -> "Inject bad report data"): the time series
      // comes back null, as if an upstream job failed. The new dashboard
      // assumes it is always present, so it crashes - a realistic regression.
      series: demoState.chaos ? null : last30,
      byTeam,
    });
    return;
  }

  res.json({
    flag: FLAG_KEYS.INSIGHTS_DASHBOARD,
    variant: 'legacy',
    generatedAt: new Date().toISOString(),
    months: legacyMonths,
  });
});
