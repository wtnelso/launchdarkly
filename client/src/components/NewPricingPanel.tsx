import { useState } from 'react';
import { usePricing } from '../usePricing';

/**
 * The redesigned pricing panel - the "new feature" behind the
 * `new-pricing-panel` flag. Three tiers, an annual-billing toggle, and a
 * highlighted recommended plan.
 *
 * It also has a "Simulate production bug" button. Clicking it makes the
 * component throw during render, exactly like a real regression would. The
 * error boundary around this panel catches it and the remediation story
 * (flag trigger) kicks in.
 */
export function NewPricingPanel() {
  const { data, error } = usePricing('new');
  const [annual, setAnnual] = useState(false);
  const [crash, setCrash] = useState(false);

  if (crash) {
    // Deliberate, realistic-looking failure inside the new code path.
    throw new TypeError("Cannot read properties of undefined (reading 'annualPrice')");
  }

  return (
    <section className="panel new" aria-labelledby="new-title">
      <div className="panel-head">
        <div>
          <h2 id="new-title">Choose the plan that grows with you</h2>
          <p className="muted">Transparent pricing. Cancel anytime.</p>
        </div>
        <span className="tag accent">New release</span>
      </div>

      <div className="billing-toggle" role="group" aria-label="Billing period">
        <button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>
          Monthly
        </button>
        <button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>
          Annual <span className="save">save 2 months</span>
        </button>
      </div>

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

      <div className="danger-zone">
        <div>
          <strong>Demo control:</strong> pretend a regression shipped inside this new panel.
        </div>
        <button className="btn btn-danger" onClick={() => setCrash(true)}>
          Simulate production bug
        </button>
      </div>

      <p className="fineprint">Served by: {data ? `server variant "${data.variant}"` : '—'}</p>
    </section>
  );
}
