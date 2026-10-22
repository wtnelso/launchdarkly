import { useInitializationStatus } from '@launchdarkly/react-sdk';
import { useCurrentContextName } from './ld/useIdentify';
import { useState } from 'react';
import { AdminDrawer, readDrawerOpen } from './components/AdminDrawer';
import { SCENARIOS, useScenario } from './scenarios';

export function App() {
  const init = useInitializationStatus();
  const [scenario, selectScenario] = useScenario();
  const [drawerOpen, setDrawerOpen] = useState(readDrawerOpen);
  const contextName = useCurrentContextName();

  const connected = init.status === 'complete';

  return (
    <>
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="logo">ABC</span>
            <span>ABC Company · Analytics</span>
          </div>

          <div className="topbar-right">
            <span className="muted small signed-in">
              Signed in as <strong>{contextName}</strong>
            </span>

            <button
              className="hamburger drawer-toggle"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? 'Close admin tools' : 'Open admin tools'}
              title={`Admin tools · LaunchDarkly ${init.status}`}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </svg>
              <span className={`hamburger-badge ${connected ? '' : 'off'}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="10" height="10">
                  <path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z" fill="currentColor" />
                </svg>
              </span>
            </button>
          </div>
        </header>

        {init.status === 'failed' && (
          <div className="banner warn">
            LaunchDarkly failed to initialize: {init.error?.message ?? 'unknown error'}. Check the client-side ID.
          </div>
        )}

        <main className="content">
          <scenario.View />
        </main>

        <AdminDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          status={<InitBadge status={init.status} />}
          top={
            <label className="field small">
              <span className="muted">Exercise part</span>
              <select className="picker" value={scenario.id} onChange={(e) => selectScenario(e.target.value)} aria-label="Exercise part">
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          <scenario.Admin />
        </AdminDrawer>
      </div>
    </>
  );
}

function InitBadge({ status }: { status: string }) {
  const label =
    status === 'complete' ? 'connected' : status === 'initializing' ? 'connecting…' : status === 'failed' ? 'failed' : status;
  const cls = status === 'complete' ? 'on' : status === 'initializing' ? 'pending' : 'off';
  return <span className={`pill ${cls}`}>{label}</span>;
}
