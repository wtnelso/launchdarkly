import { useBoolVariationDetail } from '@launchdarkly/react-sdk';
import type { EvaluationReason } from '../../api';
import { FlagActivityLog } from '../../components/FlagActivityLog';
import { FLAG_KEYS } from '../../ld/flags';
import { PERSONAS, contextFor } from './personas';
import { setPersona, useIdentifying, usePersona } from './personaStore';

/** Part 2 admin tooling: who you are, what LaunchDarkly decided, and why. */
export function Part2Admin() {
  const persona = usePersona();
  const identifying = useIdentifying();
  const detail = useBoolVariationDetail(FLAG_KEYS.LANDING_HERO_V2, false);

  return (
    <>
      <div className="card intro">
        <h3>Visitor</h3>
        <p className="small">
          Pick who is looking at the landing page. Each persona is a LaunchDarkly <em>multi-context</em> (user +
          organization); switching calls <code>identify()</code> and the hero re-renders for that visitor.
        </p>
        <div className="persona-grid">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              className={`persona ${p.id === persona.id ? 'selected' : ''}`}
              onClick={() => void setPersona(p.id)}
              disabled={identifying}
              aria-pressed={p.id === persona.id}
            >
              <strong>{p.label}</strong>
              <span className="small muted">
                {p.user.anonymous ? 'anonymous' : p.user.key} · {p.user.country}
                {p.user.role ? ` · ${p.user.role}` : ''}
                {p.user.betaTester ? ' · beta tester' : ''}
              </span>
              <span className="small muted">
                {p.organization ? `${p.organization.name} · ${p.organization.plan} · ${p.organization.employees} people` : 'no organization'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Evaluation</h3>
          <span className={`pill ${detail.value ? 'on' : 'off'}`}>{detail.value ? 'Hero v2' : 'Classic hero'}</span>
        </div>
        <p className="small muted">
          <code>{FLAG_KEYS.LANDING_HERO_V2}</code> for <strong>{persona.label}</strong>
          {identifying ? ' · identifying…' : ''}
        </p>
        <dl className="reasons">
          <div>
            <dt>Value</dt>
            <dd>
              <strong>{String(detail.value)}</strong>
            </dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{describeReason(detail.reason)}</dd>
          </div>
        </dl>
        <p className="small muted">
          The React SDK sent this persona's context to LaunchDarkly with <code>identify()</code> and got back the evaluated
          value plus the reason (<code>withReasons: true</code>). No server involved.
        </p>
        <p className="small muted">
          Expected for this persona: <strong>{persona.expectedV2 ? 'Hero v2' : 'Classic hero'}</strong> via {persona.servedBy}.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Context payload</h3>
          <span className="pill">{persona.organization ? 'multi-context' : 'single context'}</span>
        </div>
        <p className="small muted">
          Exactly what <code>identify()</code> sends to LaunchDarkly from the browser. Targeting rules match on these
          attributes; the app decides who the visitor is, LaunchDarkly decides what they get.
        </p>
        <pre className="prompt">{JSON.stringify(contextFor(persona), null, 2)}</pre>
      </div>

      <div className="card">
        <h3>Targeting to configure</h3>
        <ol className="small steps">
          <li>
            <strong>Individual target:</strong> user <code>alice-chen</code> → <em>true</em>
          </li>
          <li>
            <strong>Rule 1 “Beta testers”:</strong> user · betaTester · is one of · <code>true</code> → <em>true</em>
          </li>
          <li>
            <strong>Rule 2 “Enterprise organizations”:</strong> organization · plan · is one of · <code>enterprise</code> → <em>true</em>
          </li>
          <li>
            <strong>Default rule:</strong> serve <em>false</em>; flag <em>On</em>
          </li>
        </ol>
        <p className="small muted">Cycle through all personas once first so LaunchDarkly has seen the attributes.</p>
      </div>

      <FlagActivityLog flagKey={FLAG_KEYS.LANDING_HERO_V2} />
    </>
  );
}

function describeReason(reason: EvaluationReason | undefined): string {
  if (!reason) return 'no reason reported';
  switch (reason.kind) {
    case 'TARGET_MATCH':
      return 'Individual target';
    case 'RULE_MATCH':
      return `Rule ${(reason.ruleIndex ?? 0) + 1}`;
    case 'FALLTHROUGH':
      return 'Default rule';
    case 'OFF':
      return 'Flag is off';
    case 'PREREQUISITE_FAILED':
      return 'Prerequisite failed';
    case 'ERROR':
      return `Error: ${reason.errorKind ?? 'unknown'} (flag missing or not client-side?)`;
    default:
      return reason.kind;
  }
}
