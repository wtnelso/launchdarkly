import { useBoolVariation } from '@launchdarkly/react-sdk';
import { FlagActivityLog } from '../../components/FlagActivityLog';
import { ServerStatus } from '../../components/ServerStatus';
import { useDemoControls } from '../../demo/DemoControlsContext';
import { FLAG_KEYS } from '../../ld/flags';

/**
 * Part 1 admin tooling. Lives in the collapsible admin drawer so none of it
 * affects the customer-facing view.
 */
export function Part1Admin() {
  const flagOn = useBoolVariation(FLAG_KEYS.NEW_PRICING_PANEL, false);
  const { crashNewPanel, setCrashNewPanel } = useDemoControls();

  return (
    <>
      <div className="card intro">
        <h3>Release control</h3>
        <p className="small">
          Flag <code>{FLAG_KEYS.NEW_PRICING_PANEL}</code> gates the pricing panel. Toggle it in the LaunchDarkly UI and
          watch the page switch instantly - no reload.
        </p>
        <ol className="small steps">
          <li>
            <strong>Release:</strong> turn the flag <em>on</em>
          </li>
          <li>
            <strong>Rollback:</strong> turn it <em>off</em>
          </li>
          <li>
            <strong>Remediate:</strong> with it on, run <code>npm run remediate</code>, or use the demo control below
          </li>
        </ol>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Demo controls</h3>
          <span className={`pill ${flagOn ? 'on' : 'off'}`}>{flagOn ? 'Released' : 'Rolled back'}</span>
        </div>
        <p className="small muted">
          Pretend a regression shipped inside the new pricing panel. The error boundary reports it to the API, which
          fires the flag trigger (if <code>LD_TRIGGER_URL</code> is set).
        </p>
        <button
          className="btn btn-danger"
          disabled={!flagOn || crashNewPanel}
          onClick={() => setCrashNewPanel(true)}
          title={flagOn ? 'Throw an error inside the new pricing panel' : 'Turn the flag on first'}
        >
          Simulate production bug
        </button>
        {!flagOn && <p className="small muted">Turn the flag on first - the new panel isn't rendered right now.</p>}
      </div>

      <FlagActivityLog />
      <ServerStatus />
    </>
  );
}
