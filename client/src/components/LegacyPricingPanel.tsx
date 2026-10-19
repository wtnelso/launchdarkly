import { usePricing } from '../usePricing';

/**
 * The pricing panel ABC Company has shipped for years. This is what customers
 * see when the `new-pricing-panel` flag is OFF (including after a rollback).
 */
export function LegacyPricingPanel() {
  const { data, error } = usePricing('legacy');

  return (
    <section className="panel legacy" aria-labelledby="legacy-title">
      <div className="panel-head">
        <h2 id="legacy-title">Plans &amp; Pricing</h2>
        <span className="tag muted">Current release</span>
      </div>

      {error && <p className="error">Could not load pricing: {error}</p>}
      {!data && !error && <p className="muted">Loading plans…</p>}

      {data && (
        <table className="legacy-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Includes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.plans.map((plan) => (
              <tr key={plan.id}>
                <td>{plan.name}</td>
                <td>${plan.monthlyPrice}/mo</td>
                <td>{plan.features.join(', ')}</td>
                <td>
                  <button className="btn btn-outline">Select</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="fineprint">Served by: {data ? `server variant "${data.variant}"` : '—'}</p>
    </section>
  );
}
