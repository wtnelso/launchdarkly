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

export interface EvaluationReason {
  kind: string;
  ruleIndex?: number;
  ruleId?: string;
  errorKind?: string;
}

export interface ApiSimulationResult {
  visitors: number;
  classic: { exposures: number; conversions: number };
  v2: { exposures: number; conversions: number };
  elapsedMs: number;
  flushed: boolean;
}

export async function simulateTrafficOnApi(body: {
  visitors: number;
  convClassic: number;
  convV2: number;
}): Promise<ApiSimulationResult> {
  const res = await fetch('/api/demo/simulate-traffic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST /api/demo/simulate-traffic failed: ${res.status}`);
  return (await res.json()) as ApiSimulationResult;
}

export interface ServedAiConfig {
  key: string;
  enabled: boolean;
  variationKey: string;
  version: number;
  model: { name: string; parameters?: Record<string, unknown> } | null;
  provider: string | null;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  fallback: boolean;
}

export interface ChatTurnResult {
  enabled: boolean;
  served: ServedAiConfig;
  reply?: string;
  style?: 'concise' | 'friendly';
  metrics?: { durationMs: number; tokens: { input: number; output: number; total: number } };
  resumptionToken?: string;
  generatedAt: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const sendChat = (context: unknown, message: string) => post<ChatTurnResult>('/api/chat', { context, message });

export const sendChatFeedback = (context: unknown, resumptionToken: string, kind: 'positive' | 'negative') =>
  post<{ ok: boolean }>('/api/chat/feedback', { context, resumptionToken, kind });

export interface ChatConfigEvaluation {
  served: ServedAiConfig;
  reason: EvaluationReason;
  evaluatedAt: string;
}

export const evaluateChatConfig = (context: unknown) => post<ChatConfigEvaluation>('/api/chat/evaluate', { context });

export interface ChatSimulationResult {
  conversations: number;
  turns: number;
  disabled: number;
  byVariation: {
    variationKey: string;
    model: string;
    style: string;
    turns: number;
    positive: number;
    negative: number;
    positiveRate: number;
    avgMs: number;
    avgTokens: number;
  }[];
  elapsedMs: number;
  flushed: boolean;
}

export const simulateChatsOnApi = (body: { conversations: number; turns: number; positiveConcise: number; positiveFriendly: number }) =>
  post<ChatSimulationResult>('/api/demo/simulate-chats', body);

export interface ReportSimulationResult {
  visitors: number;
  chaos: boolean;
  legacy: { views: number };
  insights: { views: number; crashes: number };
  elapsedMs: number;
  flushed: boolean;
}

export const simulateReportsOnApi = (visitors: number) => post<ReportSimulationResult>('/api/demo/simulate-reports', { visitors });
