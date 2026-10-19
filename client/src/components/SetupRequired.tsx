/**
 * Rendered instead of the dashboard when VITE_LD_CLIENT_SIDE_ID is missing.
 * The LaunchDarkly SDK refuses to start without a client-side ID, so rather
 * than crash we explain exactly what to do.
 */
export function SetupRequired() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">ABC</span>
          <span>ABC Company · Analytics</span>
        </div>
      </header>
      <main className="layout single">
        <section className="panel">
          <div className="panel-head">
            <h2>One more step: connect LaunchDarkly</h2>
          </div>
          <p>
            <code>VITE_LD_CLIENT_SIDE_ID</code> is not set, so the app can't start the LaunchDarkly client.
          </p>
          <ol className="steps">
            <li>
              Copy <code>client/.env.example</code> to <code>client/.env</code>
            </li>
            <li>
              In LaunchDarkly open <strong>Settings → Projects → your project → Environments</strong> and copy the{' '}
              <strong>Client-side ID</strong> for the environment you're using (not the <code>sdk-…</code> key)
            </li>
            <li>
              Paste it as <code>VITE_LD_CLIENT_SIDE_ID=…</code> in <code>client/.env</code>
            </li>
            <li>
              Restart <code>npm run dev</code> (Vite reads env files at startup) and reload this page
            </li>
          </ol>
          <p className="muted small">See README.md → “LaunchDarkly setup” for the full walkthrough.</p>
        </section>
      </main>
    </div>
  );
}
