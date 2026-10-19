/** Types and helpers for the ABC analytics API (server/src/routes). */

export interface MonthRow {
  month: string;
  activeUsers: number;
  apiCalls: number;
  storageGb: number;
}

export interface Kpi {
  id: string;
  label: string;
  value: number;
  unit: '' | 'GB' | 'ms';
  deltaPct: number;
}

export interface SeriesPoint {
  date: string;
  activeUsers: number;
  apiCalls: number;
}

export interface TeamUsage {
  team: string;
  apiCalls: number;
  sharePct: number;
}

export interface LegacyUsageReport {
  flag: string;
  variant: 'legacy';
  generatedAt: string;
  months: MonthRow[];
}

export interface InsightsReport {
  flag: string;
  variant: 'new';
  generatedAt: string;
  period: { from: string; to: string };
  kpis: Kpi[];
  /** Normally an array; the demo's chaos mode makes the API return null here. */
  series: SeriesPoint[];
  byTeam: TeamUsage[];
}

export type UsageReport = LegacyUsageReport | InsightsReport;

export async function fetchUsageReport(): Promise<UsageReport> {
  const res = await fetch('/api/reports/usage');
  if (!res.ok) throw new Error(`GET /api/reports/usage failed: ${res.status}`);
  return (await res.json()) as UsageReport;
}

export interface ReportErrorResponse {
  remediated: boolean;
  reason?: string;
  triggerStatus?: number;
}

export async function reportError(flag: string, message: string): Promise<ReportErrorResponse> {
  const res = await fetch('/api/report-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flag, message }),
  });
  return (await res.json()) as ReportErrorResponse;
}

/** 12980000 -> "13.0M", 544 -> "544", 1234 -> "1.2K" */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export async function setChaos(enabled: boolean): Promise<boolean> {
  const res = await fetch('/api/demo/chaos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  return ((await res.json()) as { enabled: boolean }).enabled;
}

/** Part 2: LaunchDarkly's evaluation detail for landing-hero-v-2, computed server-side. */
export interface EvaluationReason {
  kind: string;
  ruleIndex?: number;
  ruleId?: string;
  errorKind?: string;
}

export interface LandingEvaluation {
  flag: string;
  value: boolean;
  variationIndex?: number | null;
  reason: EvaluationReason;
  evaluatedAt: string;
}

export async function evaluateLanding(context: unknown): Promise<LandingEvaluation> {
  const res = await fetch('/api/landing/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });
  if (!res.ok) throw new Error(`POST /api/landing/evaluate failed: ${res.status}`);
  return (await res.json()) as LandingEvaluation;
}
