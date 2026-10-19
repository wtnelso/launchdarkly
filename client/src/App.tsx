import { useInitializationStatus } from '@launchdarkly/react-sdk';
import { useState } from 'react';
import { AdminDrawer, readDrawerOpen } from './components/AdminDrawer';
import { DemoControlsProvider } from './demo/DemoControlsContext';
import { demoContext } from './ld/provider';
import { SCENARIOS, useScenario } from './scenarios';

export function App() {
  const init = useInitializationStatus();
  const [scenario, selectScenario] = useScenario();
  const [drawerOpen, setDrawerOpen] = useState(readDrawerOpen);

  const connected = init.status === 'complete';

  return (
    <DemoControlsProvider>
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="logo">ABC</span>
            <span>ABC Company · Billing Dashboard</span>
          </div>

          <div className="topbar-right">
            <span className="muted small signed-in">
              Signed in as <strong>{demoContext.name}</strong>
            </span>

            {/* Admin tooling lives in the drawer so the customer view stays clean. */}
            <button
              className={`btn btn-outline btn-sm drawer-toggle ${drawerOpen ? 'active' : ''}`}
              onClick={() => setDrawerOpen((o) => !o)}
              aria-expanded={drawerOpen}
              title={`LaunchDarkly ${init.status}`}
            >
              <span className={`dot ${connected ? 'on' : 'off'}`} /> Admin
            </button>

            {/* Exercise part picker: each part has its own end-user view and admin panel. */}
            <select
              className="picker"
              value={scenario.id}
              onChange={(e) => selectScenario(e.target.value)}
              aria-label="Exercise part"
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {init.status === 'failed' && (
          <div className="banner warn">
            LaunchDarkly failed to initialize: {init.error?.message ?? 'unknown error'}. Check the client-side ID.
          </div>
        )}

        <main className="content">
          {init.status === 'initializing' ? (
            <section className="panel">
              <p className="muted">Connecting to LaunchDarkly…</p>
            </section>
          ) : (
            <scenario.View />
          )}
        </main>

        <AdminDrawer open={drawerOpen} onOpenChange={setDrawerOpen} status={<InitBadge status={init.status} />}>
          <scenario.Admin />
        </AdminDrawer>
      </div>
    </DemoControlsProvider>
  );
}

function InitBadge({ status }: { status: string }) {
  const label =
    status === 'complete' ? 'connected' : status === 'initializing' ? 'connecting…' : status === 'failed' ? 'failed' : status;
  const cls = status === 'complete' ? 'on' : status === 'initializing' ? 'pending' : 'off';
  return <span className={`pill ${cls}`}>{label}</span>;
}
