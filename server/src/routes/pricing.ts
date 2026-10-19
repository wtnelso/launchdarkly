/**
 * GET /api/pricing
 *
 * Returns the pricing data the dashboard renders. The *shape* of the response
 * depends on the same feature flag the React app evaluates, so the demo can
 * show the client and server agreeing in real time:
 *
 *   flag OFF -> "legacy" variant: the two plans ABC Company has sold for years
 *   flag ON  -> "new" variant: the redesigned three-tier pricing with annual billing
 */
import { Router } from 'express';
import { FLAG_KEYS, isNewPricingPanelOn } from '../ld.js';

export interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  /** Only present in the new variant (annual billing discount). */
  annualPrice?: number;
  features: string[];
  highlighted?: boolean;
}

const legacyPlans: Plan[] = [
  { id: 'basic', name: 'Basic', monthlyPrice: 29, features: ['5 seats', 'Email support', '10 GB storage'] },
  { id: 'business', name: 'Business', monthlyPrice: 99, features: ['25 seats', 'Priority support', '100 GB storage'] },
];

const newPlans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 19,
    annualPrice: 190,
    features: ['3 seats', 'Community support', '5 GB storage'],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 79,
    annualPrice: 790,
    features: ['25 seats', 'Priority support', '250 GB storage', 'SSO'],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 249,
    annualPrice: 2490,
    features: ['Unlimited seats', 'Dedicated CSM', 'Unlimited storage', 'SSO + SCIM', 'Audit log'],
  },
];

export const pricingRouter = Router();

pricingRouter.get('/pricing', async (_req, res) => {
  // Server-side evaluation. The SDK answers from its in-memory flag store,
  // so this is a local lookup - no network call per request.
  const newPanel = await isNewPricingPanelOn();

  res.json({
    flag: FLAG_KEYS.NEW_PRICING_PANEL,
    variant: newPanel ? 'new' : 'legacy',
    evaluatedAt: new Date().toISOString(),
    plans: newPanel ? newPlans : legacyPlans,
  });
});
