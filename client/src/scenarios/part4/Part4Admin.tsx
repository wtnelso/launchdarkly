import { useEffect, useState } from 'react';
import { evaluateChatConfig, simulateChatsOnApi, type ChatConfigEvaluation, type ChatSimulationResult, type EvaluationReason } from '../../api';
import { FLAG_KEYS } from '../../ld/flags';
import { PERSONAS, contextFor } from '../part2/personas';
import { setPersona, useIdentifying, usePersona } from '../part2/personaStore';
import { useChat } from './chatStore';

/**
 * Part 4 (extra credit) admin tooling: which AI Config variation (model +
 * prompt) is answering the current visitor and why, the metrics of each
 * turn, and a simulator that fills the experiment on the config's variations.
 */
export function Part4Admin() {
  const persona = usePersona();
  const identifying = useIdentifying();
  const chat = useChat();
  const [evaluation, setEvaluation] = useState<ChatConfigEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-evaluate the config for the current persona after every persona change and every reply
  // (a reply may have been produced by a variation that was just edited in LaunchDarkly).
  useEffect(() => {
    let cancelled = false;
    evaluateChatConfig(contextFor(persona)).then(
      (res) => {
        if (!cancelled) {
          setEvaluation(res);
          setError(null);
        }
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [persona, chat.turns]);

  const served = evaluation?.served;
  const pillClass = !served ? '' : !served.enabled ? 'warn' : served.fallback ? 'warn' : 'on';
  const pillLabel = !served ? 'evaluating…' : !served.enabled ? 'Config off' : served.fallback ? 'Fallback' : served.variationKey;
  const params = served?.model?.parameters ? Object.entries(served.model.parameters) : [];
  const replies = chat.messages.filter((m) => m.turn);

  return (
    <>
      <div className="card intro">
        <h3>AI Config</h3>
        <p className="small">
          The assistant's <strong>model and prompt</strong> live in the LaunchDarkly AI Config <code>{FLAG_KEYS.SUPPORT_ASSISTANT}</code>, not
          in code. Each variation is a model plus messages with <code>{'{{customerName}}'}</code>-style variables; targeting decides which
          variation a visitor gets. Edit the prompt in LaunchDarkly and the next reply changes - no deploy.
        </p>
        <p className="small muted">
          Every reply is measured through the AI SDK's tracker (duration, tokens, success, thumbs up/down). Those metrics power the
          config's Monitoring tab and the experiment on its variations.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Served configuration</h3>
          <span className={`pill ${pillClass}`}>{pillLabel}</span>
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
        {error && <p className="small error">{error}</p>}
        {served && (
          <>
            <dl className="reasons">
              <div>
                <dt>Variation</dt>
                <dd>
                  <strong>{served.variationKey || (served.fallback ? 'in-code default' : '–')}</strong> · v{served.version}
                </dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>
                  <strong>{served.model?.name ?? '–'}</strong>
                  {served.provider ? ` · ${served.provider}` : ''}
                  {params.length > 0 && (
                    <span className="muted"> · {params.map(([k, v]) => `${k}=${String(v)}`).join(', ')}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Reason</dt>
                <dd>{describeReason(evaluation?.reason)}</dd>
              </div>
            </dl>
            {served.fallback && (
              <p className="small muted">
                LaunchDarkly did not serve <code>{FLAG_KEYS.SUPPORT_ASSISTANT}</code> (not created yet, different key, or SDK offline), so the
                in-code default is in use. Create the AI Config to take control.
              </p>
            )}
            {!served.enabled && <p className="small muted">The config is toggled off for this environment: the assistant is unavailable to customers.</p>}
            {served.messages.length > 0 && (
              <details className="small" open>
                <summary className="muted">Rendered prompt ({served.messages.length} message{served.messages.length === 1 ? '' : 's'})</summary>
                {served.messages.map((m, i) => (
                  <pre className="prompt" key={i}>
                    <span className="muted">{m.role}: </span>
                    {m.content}
                  </pre>
                ))}
              </details>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Turns</h3>
          <span className="pill">{replies.length} this session</span>
        </div>
        <p className="small muted">What the tracker recorded for each reply in this browser.</p>
        {replies.length > 0 && (
          <ul className="log">
            {replies.map((m) => (
              <li key={m.id}>
                <time>{new Date(m.at).toLocaleTimeString()}</time>
                <span className={`dot ${m.turn!.feedback === 'negative' ? 'off' : 'on'}`} />
                <span>
                  {m.turn!.served.variationKey || 'fallback'} · {m.turn!.served.model?.name ?? '?'} · {m.turn!.durationMs} ms · {m.turn!.tokens} tok ·{' '}
                  {m.turn!.feedback === 'positive' ? '👍' : m.turn!.feedback === 'negative' ? '👎' : 'unrated'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SimulateConversations />

      <div className="card">
        <h3>What to look at in LaunchDarkly</h3>
        <ol className="small steps">
          <li>
            <strong>Agents → Configs → </strong>
            <code>{FLAG_KEYS.SUPPORT_ASSISTANT}</code>: the variations (model + messages) and the Targeting tab that picks one per visitor.
          </li>
          <li>
            <strong>Monitoring tab:</strong> Generations, Satisfaction (thumbs up rate), Time to generate, Tokens and Costs, per variation.
          </li>
          <li>
            <strong>Experiment Results:</strong> positive feedback rate per variation with probability to beat control; completion time and
            tokens as secondary metrics.
          </li>
          <li>
            <strong>Contexts:</strong> filter on <code>synthetic</code> to see the simulated visitors.
          </li>
        </ol>
      </div>
    </>
  );
}

function SimulateConversations() {
  const [conversations, setConversations] = useState(300);
  const [turns, setTurns] = useState(2);
  const [positiveConcise, setPositiveConcise] = useState(55);
  const [positiveFriendly, setPositiveFriendly] = useState(80);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChatSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await simulateChatsOnApi({ conversations, turns, positiveConcise: positiveConcise / 100, positiveFriendly: positiveFriendly / 100 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3>Simulate conversations</h3>
        <span className={`pill ${busy ? 'pending' : result ? 'on' : ''}`}>{busy ? 'Running…' : result ? 'Done' : 'Ready'}</span>
      </div>
      <p className="small muted">
        The API creates visitors with random keys, evaluates the AI Config for each (its own experiment bucket), generates replies with
        duration and token metrics, and rates them: a <em>friendly</em>-style prompt gets a thumbs up more often than a <em>concise</em> one,
        so the experiment has a satisfaction difference to find.
      </p>
      <div className="sim-fields">
        <label className="field small">
          <span className="muted">Conversations</span>
          <input type="number" min={10} max={2000} step={10} value={conversations} onChange={(e) => setConversations(Number(e.target.value))} disabled={busy} />
        </label>
        <label className="field small">
          <span className="muted">Turns each</span>
          <input type="number" min={1} max={5} value={turns} onChange={(e) => setTurns(Number(e.target.value))} disabled={busy} />
        </label>
        <label className="field small">
          <span className="muted">Concise 👍 %</span>
          <input type="number" min={0} max={100} value={positiveConcise} onChange={(e) => setPositiveConcise(Number(e.target.value))} disabled={busy} />
        </label>
        <label className="field small">
          <span className="muted">Friendly 👍 %</span>
          <input type="number" min={0} max={100} value={positiveFriendly} onChange={(e) => setPositiveFriendly(Number(e.target.value))} disabled={busy} />
        </label>
      </div>
      <div className="sim-actions">
        <button className="btn btn-primary" onClick={() => void run()} disabled={busy} title="POST /api/demo/simulate-chats">
          {busy ? 'Simulating…' : `Simulate ${conversations} conversations`}
        </button>
      </div>
      {result && (
        <table className="stats">
          <caption className="small muted">
            Node SDK on the API · {result.conversations} conversations × {result.turns} turns in {result.elapsedMs} ms
            {result.disabled > 0 ? ` · ${result.disabled} turns skipped (config off)` : ''}
          </caption>
          <thead>
            <tr>
              <th>Variation</th>
              <th className="num">Turns</th>
              <th className="num">👍 rate</th>
              <th className="num">Avg ms</th>
              <th className="num">Avg tok</th>
            </tr>
          </thead>
          <tbody>
            {result.byVariation.map((v) => (
              <tr key={v.variationKey}>
                <td>
                  {v.variationKey}
                  <span className="muted small"> · {v.model}</span>
                </td>
                <td className="num">{v.turns}</td>
                <td className="num">{(v.positiveRate * 100).toFixed(0)}%</td>
                <td className="num">{v.avgMs}</td>
                <td className="num">{v.avgTokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p className="small error">{error}</p>}
    </div>
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
      return 'Default rule (the experiment, when one is running)';
    case 'OFF':
      return 'Config is off';
    case 'ERROR':
      return reason.errorKind === 'FLAG_NOT_FOUND' ? 'Config not found in LaunchDarkly' : `Error: ${reason.errorKind ?? 'unknown'}`;
    default:
      return reason.kind;
  }
}
