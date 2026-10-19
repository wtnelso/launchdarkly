/** Types and helpers for the ABC billing API (server/src/routes). */

export interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice?: number;
  features: string[];
  highlighted?: boolean;
}

export interface PricingResponse {
  flag: string;
  variant: 'new' | 'legacy';
  evaluatedAt: string;
  plans: Plan[];
}

export async function fetchPricing(): Promise<PricingResponse> {
  const res = await fetch('/api/pricing');
  if (!res.ok) throw new Error(`GET /api/pricing failed: ${res.status}`);
  return (await res.json()) as PricingResponse;
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
