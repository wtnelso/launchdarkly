import { useBoolVariation } from '@launchdarkly/react-sdk';
import { useState } from 'react';
import { setChaos } from '../../api';
import { FlagActivityLog } from '../../components/FlagActivityLog';
import { ServerStatus } from '../../components/ServerStatus';
import { FLAG_KEYS } from '../../ld/flags';
import { logFlagEvent } from '../../ld/telemetry';

/**
 * Part 1 admin tooling. Lives in the collapsible admin drawer so none of it
 * affects the customer-facing view.
 */
export function Part1Admin() {
  const flagOn = useBoolVariation(FLAG_KEYS.INSIGHTS_DASHBOARD, false);
  // Mirrors the API's chaos state; kept current by the server-sent events the
  // <ServerStatus> card already subscribes to.
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

      <FlagActivityLog />
      <ServerStatus onEvent={(e) => setChaosState(e.chaos)} />
    </>
  );
}
