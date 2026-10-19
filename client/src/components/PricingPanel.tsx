import { useState } from 'react';
import { useDemoControls } from '../demo/DemoControlsContext';
import { usePricing } from '../usePricing';

interface Props {
  /**
   * 'legacy' = what customers see today (two plans, monthly billing).
   * 'new'    = the release behind the `new-pricing-panel` flag (three plans,
   *            annual billing toggle, highlighted recommended plan).
   * Both share one layout so a flag flip reads as a product change, not a redesign.
   */
  variant: 'legacy' | 'new';
}

export function PricingPanel({ variant }: Props) {
  const { data, error } = usePricing(variant);
  const [annual, setAnnual] = useState(false);
  const { crashNewPanel } = useDemoControls();

  // Demo hook: the admin drawer's "Simulate production bug" makes the *new*
  // code path throw during render, exactly like a real regression would. The
  // error boundary around this panel catches it and the kill switch kicks in.
  if (variant === 'new' && crashNewPanel) {
    throw new TypeError("Cannot read properties of undefined (reading 'annualPrice')");
  }

  const hasAnnual = data?.plans.some((p) => p.annualPrice) ?? false;

  return (
    <section className="panel pricing" aria-labelledby="pricing-title">
      <div className="panel-head">
        <div>
          <h2 id="pricing-title">Choose the plan that's right for your team</h2>
          <p className="muted">Transparent pricing. Cancel anytime.</p>
        </div>
      </div>

      {hasAnnual && (
        <div className="billing-toggle" role="group" aria-label="Billing period">
          <button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>
            Monthly
          </button>
          <button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>
            Annual <span className="save">save 2 months</span>
          </button>
        </div>
      )}

      {error && <p className="error">Could not load pricing: {error}</p>}
      {!data && !error && <p className="muted">Loading plans…</p>}

      {data && (
        <div className="tiers">
          {data.plans.map((plan) => (
            <article key={plan.id} className={`tier ${plan.highlighted ? 'highlighted' : ''}`}>
              {plan.highlighted && <div className="ribbon">Most popular</div>}
              <h3>{plan.name}</h3>
              <p className="price">
                ${annual && plan.annualPrice ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice}
                <span>/mo</span>
              </p>
              {annual && plan.annualPrice && <p className="muted small">${plan.annualPrice} billed yearly</p>}
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button className={plan.highlighted ? 'btn btn-primary' : 'btn btn-outline'}>Start free trial</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
