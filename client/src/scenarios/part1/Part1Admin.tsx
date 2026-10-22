import { useBoolVariation } from '@launchdarkly/react-sdk';
import { useState } from 'react';
import { setChaos, simulateReportsOnApi, type ReportSimulationResult } from '../../api';
import { FlagActivityLog } from '../../components/FlagActivityLog';
import { ServerStatus } from '../../components/ServerStatus';
import { FLAG_KEYS } from '../../ld/flags';
import { METRIC_EVENTS } from '../../ld/metrics';
import { logFlagEvent } from '../../ld/telemetry';

export function Part1Admin() {
  const flagOn = useBoolVariation(FLAG_KEYS.INSIGHTS_DASHBOARD, false);
  const [chaos, setChaosState] = useState(false);
  const [busy, setBusy] = useState(false);

  const injectBadData = async () => {
    setBusy(true);
    try {
      setChaosState(await setChaos(true));
      logFlagEvent('Bad report data injected (chaos mode on)', 'warn', { event: 'chaos_on', value: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card intro">
        <h3>Release control</h3>
        <p className="small">
          Flag <code>{FLAG_KEYS.INSIGHTS_DASHBOARD}</code> gates the Insights dashboard. Toggle it in the LaunchDarkly UI
          and watch the page switch instantly - no reload.
        </p>
        <ol className="small steps">
          <li>
            <strong>Release:</strong> turn the flag <em>on</em>
          </li>
          <li>
            <strong>Rollback:</strong> turn it <em>off</em>
          </li>
          <li>
            <strong>Remediate:</strong> with it on, run <code>npm run remediate</code>, or inject a bug below and let
            the kill switch do it
          </li>
        </ol>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Demo controls</h3>
          <span className={`pill ${chaos ? 'warn' : flagOn ? 'on' : 'off'}`}>
            {chaos ? 'Bad data live' : flagOn ? 'Released' : 'Rolled back'}
          </span>
        </div>
        <p className="small muted">
          Simulate a bad upstream deploy: the API starts returning a malformed Insights payload (<code>series: null</code>
          ). The new dashboard crashes on it, the error boundary reports it to LaunchDarkly Observability and to the API,
          and the API fires the flag trigger. Rolling back also retires the bad data.
        </p>
        <button className="btn btn-danger" disabled={!flagOn || chaos || busy} onClick={injectBadData}>
          Inject bad report data
        </button>
        {!flagOn && <p className="small muted">Turn the flag on first - the Insights dashboard isn't rendered right now.</p>}
      </div>

      <GuardedRollout chaos={chaos} />

      <FlagActivityLog />
      <ServerStatus onEvent={(e) => setChaosState(e.chaos)} />
    </>
  );
}

function GuardedRollout({ chaos }: { chaos: boolean }) {
  const [visitors, setVisitors] = useState(300);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReportSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await simulateReportsOnApi(visitors));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3>Guarded rollout (optional)</h3>
        <span className={`pill ${busy ? 'pending' : result ? 'on' : ''}`}>{busy ? 'Running…' : result ? 'Done' : 'Ready'}</span>
      </div>
      <p className="small muted">
        Prefer LaunchDarkly to decide instead of a trigger? Run <code>{FLAG_KEYS.INSIGHTS_DASHBOARD}</code> as a guarded
        rollout watching the <code>{METRIC_EVENTS.INSIGHTS_CRASH}</code> metric: it ramps the new dashboard up gradually and
        rolls back automatically when it crashes more than the old table. The browser sends that event on a real crash; this
        button sends it for many visitors at once so the rollout has data to judge. It needs volume and a few minutes, so
        the live demo uses the trigger.
      </p>
      <ol className="small steps">
        <li>With bad data <strong>off</strong>, simulate: both arms healthy, the rollout advances.</li>
        <li>
          Click <strong>Inject bad report data</strong>, simulate again: every visitor on the new dashboard crashes.
        </li>
        <li>LaunchDarkly detects the regression and turns the flag off: no trigger, no human.</li>
      </ol>
      <div className="sim-fields">
        <label className="field small">
          <span className="muted">Visitors</span>
          <input type="number" min={10} max={5000} step={10} value={visitors} onChange={(e) => setVisitors(Number(e.target.value))} disabled={busy} />
        </label>
      </div>
      <div className="sim-actions">
        <button className="btn btn-primary" onClick={() => void run()} disabled={busy} title="POST /api/demo/simulate-reports">
          {busy ? 'Simulating…' : `Simulate ${visitors} visitors${chaos ? ' (bad data live)' : ''}`}
        </button>
      </div>
      {result && (
        <table className="stats">
          <caption className="small muted">
            Node SDK on the API · {result.visitors} visitors in {result.elapsedMs} ms{result.chaos ? ' · bad data was live' : ''}
          </caption>
          <thead>
            <tr>
              <th>Variation</th>
              <th className="num">Views</th>
              <th className="num">Crashes</th>
              <th className="num">Crash rate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Usage table (false)</td>
              <td className="num">{result.legacy.views}</td>
              <td className="num">0</td>
              <td className="num">{result.legacy.views ? '0%' : '–'}</td>
            </tr>
            <tr>
              <td>Insights (true)</td>
              <td className="num">{result.insights.views}</td>
              <td className="num">{result.insights.crashes}</td>
              <td className="num">{result.insights.views ? `${Math.round((100 * result.insights.crashes) / result.insights.views)}%` : '–'}</td>
            </tr>
          </tbody>
        </table>
      )}
      {error && <p className="small error">{error}</p>}
    </div>
  );
}
