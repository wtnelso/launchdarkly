import { useBoolVariationDetail } from '@launchdarkly/react-sdk';
import { useState } from 'react';
import { simulateTrafficOnApi, type ApiSimulationResult } from '../../api';
import { FLAG_KEYS } from '../../ld/flags';
import { METRIC_EVENTS, useConversionLog } from '../../ld/metrics';
import { PERSONAS } from '../part2/personas';
import { setPersona, useIdentifying, usePersona } from '../part2/personaStore';
import { cancelSimulation, DEFAULT_SIM, runSimulation, useSimulation, type VariationStats } from './simulateTraffic';

/**
 * Part 3 (extra credit) admin tooling: run an A/B experiment on the Part 2
 * hero. The landing page is unchanged; what changes is that LaunchDarkly now
 * splits the *default rule* 50/50 and measures the `hero-cta-click` metric for
 * each variation.
 */
export function Part3Admin() {
  const persona = usePersona();
  const identifying = useIdentifying();
  const detail = useBoolVariationDetail(FLAG_KEYS.LANDING_HERO_V2, false);
  const conversions = useConversionLog();
  const inExperiment = detail.reason?.kind === 'FALLTHROUGH';

  return (
    <>
      <div className="card intro">
        <h3>Experiment</h3>
        <p className="small">
          Flag <code>{FLAG_KEYS.LANDING_HERO_V2}</code>, metric <code>{METRIC_EVENTS.HERO_CTA_CLICK}</code>. Visitors who
          reach the <em>default rule</em> are split 50/50 between the classic hero and hero v2; clicking a hero's primary
          button calls <code>client.track()</code> and LaunchDarkly attributes the conversion to the variation that
          visitor saw.
        </p>
        <p className="small muted">
          Targeted visitors (Alice, Bruno, Carla) are served by their target or rule, so they are <em>not</em> in the
          experiment. The anonymous visitor falls through and is.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Your own clicks</h3>
          <span className={`pill ${inExperiment ? 'on' : 'off'}`}>{inExperiment ? 'In experiment' : 'Not in experiment'}</span>
        </div>
        <label className="field small">
          <span className="muted">Visitor</span>
          <select className="picker" value={persona.id} onChange={(e) => void setPersona(e.target.value)} disabled={identifying}>
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="small muted">
          Seeing <strong>{detail.value ? 'Hero v2' : 'Classic hero'}</strong> via {reasonLabel(detail.reason?.kind)}. Click
          the hero's primary button on the page to send a conversion for this visitor.
        </p>
        {conversions.length > 0 && (
          <ul className="log">
            {conversions.map((c) => (
              <li key={c.at}>
                <time>{new Date(c.at).toLocaleTimeString()}</time>
                <span className={`dot ${c.hero === 'v2' ? 'on' : 'off'}`} />
                <span>
                  <code>{METRIC_EVENTS.HERO_CTA_CLICK}</code> · {c.contextKey} · {c.hero} · {(c.msToClick / 1000).toFixed(1)}s
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SimulateTraffic />

      <div className="card">
        <h3>What to look at in LaunchDarkly</h3>
        <ol className="small steps">
          <li>
            <strong>Metrics</strong> → <em>Hero CTA click</em>: event key <code>{METRIC_EVENTS.HERO_CTA_CLICK}</code>,
            conversion (binary), randomization unit <em>user</em>.
          </li>
          <li>
            <strong>Flag → Experimentation</strong> (or <strong>Experiments</strong>): the running experiment on this flag's
            default rule, 50/50.
          </li>
          <li>
            <strong>Results tab:</strong> exposures per variation, conversion rate, the <em>probability to beat control</em>
            and the credible interval for the relative difference. Data lands within a few minutes of a run.
          </li>
          <li>
            <strong>Contexts:</strong> filter on <code>synthetic</code> to see the simulated visitors and their attributes.
          </li>
        </ol>
      </div>
    </>
  );
}

function SimulateTraffic() {
  const sim = useSimulation();
  const [visitors, setVisitors] = useState(DEFAULT_SIM.visitors);
  const [convClassic, setConvClassic] = useState(Math.round(DEFAULT_SIM.convClassic * 100));
  const [convV2, setConvV2] = useState(Math.round(DEFAULT_SIM.convV2 * 100));
  const [api, setApi] = useState<ApiSimulationResult | null>(null);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const busy = sim.status === 'running' || sim.status === 'flushing';
  const config = { visitors, convClassic: convClassic / 100, convV2: convV2 / 100 };

  const runOnApi = async () => {
    setApiBusy(true);
    setApiError(null);
    try {
      setApi(await simulateTrafficOnApi({ ...config, visitors: Math.max(visitors, 500) }));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setApiBusy(false);
    }
  };

  const elapsed = sim.startedAt ? ((sim.finishedAt ?? Date.now()) - sim.startedAt) / 1000 : 0;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Simulate traffic</h3>
        <span className={`pill ${busy ? 'pending' : sim.status === 'done' ? 'on' : ''}`}>{statusLabel(sim.status)}</span>
      </div>
      <p className="small muted">
        Generates visitors with random keys and attributes. For each one the browser SDK calls <code>identify()</code>{' '}
        (LaunchDarkly buckets the visitor and records the exposure), reads the variation, and converts with the
        probability below - so the experiment has a real difference to detect.
      </p>
      <div className="sim-fields">
        <label className="field small">
          <span className="muted">Visitors</span>
          <input type="number" min={10} max={2000} step={10} value={visitors} onChange={(e) => setVisitors(Number(e.target.value))} disabled={busy} />
        </label>
        <label className="field small">
          <span className="muted">Classic conv. %</span>
          <input type="number" min={0} max={100} value={convClassic} onChange={(e) => setConvClassic(Number(e.target.value))} disabled={busy} />
        </label>
        <label className="field small">
          <span className="muted">Hero v2 conv. %</span>
          <input type="number" min={0} max={100} value={convV2} onChange={(e) => setConvV2(Number(e.target.value))} disabled={busy} />
        </label>
      </div>
      <div className="sim-actions">
        {busy ? (
          <button className="btn btn-outline" onClick={cancelSimulation} disabled={sim.status === 'flushing'}>
            Stop
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => void runSimulation(config)}>
            Simulate {visitors} visitors
          </button>
        )}
        <button className="btn btn-outline" onClick={() => void runOnApi()} disabled={apiBusy || busy} title="POST /api/demo/simulate-traffic">
          {apiBusy ? 'Running on API…' : `Bulk: ${Math.max(visitors, 500)} via API`}
        </button>
      </div>

      {sim.status !== 'idle' && (
        <>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={sim.total} aria-valuenow={sim.done}>
            <span style={{ width: `${sim.total ? (100 * sim.done) / sim.total : 0}%` }} />
          </div>
          <p className="small muted">
            {sim.done}/{sim.total} visitors · {elapsed.toFixed(0)}s
            {sim.identifyErrors > 0 ? ` · ${sim.identifyErrors} identify errors` : ''}
            {sim.status === 'flushing' ? ' · flushing events to LaunchDarkly…' : ''}
            {sim.status === 'done' ? ' · events flushed, persona restored' : ''}
          </p>
          <StatsTable classic={sim.classic} v2={sim.v2} caption="Browser SDK (this run)" />
          {sim.error && <p className="small error">{sim.error}</p>}
        </>
      )}

      {api && (
        <StatsTable classic={api.classic} v2={api.v2} caption={`Node SDK on the API · ${api.visitors} visitors in ${api.elapsedMs} ms`} />
      )}
      {apiError && <p className="small error">{apiError}</p>}
    </div>
  );
}

function StatsTable({ classic, v2, caption }: { classic: VariationStats; v2: VariationStats; caption: string }) {
  const rate = (s: VariationStats) => (s.exposures ? `${((100 * s.conversions) / s.exposures).toFixed(1)}%` : '–');
  return (
    <table className="stats">
      <caption className="small muted">{caption}</caption>
      <thead>
        <tr>
          <th>Variation</th>
          <th className="num">Exposures</th>
          <th className="num">Conversions</th>
          <th className="num">Rate</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Classic hero (false)</td>
          <td className="num">{classic.exposures}</td>
          <td className="num">{classic.conversions}</td>
          <td className="num">{rate(classic)}</td>
        </tr>
        <tr>
          <td>Hero v2 (true)</td>
          <td className="num">{v2.exposures}</td>
          <td className="num">{v2.conversions}</td>
          <td className="num">{rate(v2)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'running':
      return 'Running…';
    case 'flushing':
      return 'Flushing…';
    case 'done':
      return 'Done';
    case 'cancelled':
      return 'Stopped';
    default:
      return status;
  }
}

function reasonLabel(kind: string | undefined): string {
  switch (kind) {
    case 'TARGET_MATCH':
      return 'an individual target';
    case 'RULE_MATCH':
      return 'a targeting rule';
    case 'FALLTHROUGH':
      return 'the default rule (the experiment)';
    case 'OFF':
      return 'the flag being off';
    default:
      return kind ?? 'an unknown reason';
  }
}
