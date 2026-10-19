import { useInitializationStatus } from '@launchdarkly/react-sdk';
import { FeatureGate } from './components/FeatureGate';
import { FlagActivityLog } from './components/FlagActivityLog';
import { ServerStatus } from './components/ServerStatus';
import { FLAG_KEYS } from './ld/flags';
import { demoContext } from './ld/provider';

export function App() {
  const init = useInitializationStatus();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">ABC</span>
          <span>ABC Company · Billing Dashboard</span>
        </div>
        <div className="muted small">
          Signed in as <strong>{demoContext.name}</strong> · LaunchDarkly: <InitBadge status={init.status} />
        </div>
      </header>

      {init.status === 'failed' && (
        <div className="banner warn">
          LaunchDarkly failed to initialize: {init.error?.message ?? 'unknown error'}. Check the client-side ID.
        </div>
      )}

      <main className="layout">
        <div className="content">
          {init.status === 'initializing' ? (
            <section className="panel">
              <p className="muted">Connecting to LaunchDarkly…</p>
            </section>
          ) : (
            <FeatureGate />
          )}
        </div>

        <aside className="sidebar">
          <div className="card intro">
            <h3>Release control</h3>
            <p className="small">
              Flag <code>{FLAG_KEYS.NEW_PRICING_PANEL}</code> gates the pricing panel on the left. Toggle it in the
              LaunchDarkly UI and watch this page switch instantly - no reload.
            </p>
            <ol className="small steps">
              <li>
                <strong>Release:</strong> turn the flag <em>on</em>
              </li>
              <li>
                <strong>Rollback:</strong> turn it <em>off</em>
              </li>
              <li>
                <strong>Remediate:</strong> with it on, click “Simulate production bug”, then run{' '}
                <code>npm run remediate</code>
              </li>
            </ol>
          </div>
          <FlagActivityLog />
          <ServerStatus />
        </aside>
      </main>
    </div>
  );
}

function InitBadge({ status }: { status: 'initializing' | 'complete' | 'failed' | 'timeout' | (string & {}) }) {
  const label =
    status === 'complete' ? 'connected' : status === 'initializing' ? 'connecting…' : status === 'failed' ? 'failed' : status;
  const cls = status === 'complete' ? 'on' : status === 'initializing' ? 'pending' : 'off';
  return <span className={`pill ${cls}`}>{label}</span>;
}
