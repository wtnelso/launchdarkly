import { useBoolVariation, useLDClient } from '@launchdarkly/react-sdk';
import { useEffect, useState } from 'react';
import { FLAG_KEYS, type FlagKey } from '../ld/flags';
import { logFlagEvent } from '../ld/telemetry';

/** React's development double-mount would log the page-load evaluation twice; only log it once per flag. */
const pageLoadLogged = new Set<string>();

interface Entry {
  at: string;
  value: boolean;
  source: 'initial' | 'stream';
}

/**
 * An explicit flag-change *listener* so the mechanism is visible, not just its
 * effect.
 *
 * The hooks (useBoolVariation) already re-render on change. This component
 * additionally registers `client.on('change:<flag-key>')` - the same event
 * the hooks use under the hood - and writes a timestamped audit line each
 * time LaunchDarkly pushes a new value over the stream.
 */
export function FlagActivityLog({ flagKey = FLAG_KEYS.INSIGHTS_DASHBOARD }: { flagKey?: FlagKey }) {
  const client = useLDClient();
  const current = useBoolVariation(flagKey, false);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const eventName = `change:${flagKey}`;

    let lastValue = client.boolVariation(flagKey, false);

    // The change event doesn't carry the value, so read it inside the handler.
    // The SDK also emits the event while it finishes loading flags, so only log
    // when the value actually differs from what we last saw.
    const onChange = () => {
      const value = client.boolVariation(flagKey, false);
      if (value === lastValue) return;
      lastValue = value;
      const entry: Entry = { at: new Date().toISOString(), value, source: 'stream' };
      setEntries((prev) => [entry, ...prev].slice(0, 20));
      // Also tell LaunchDarkly Observability (shows under the flag's Monitoring > Logs).
      logFlagEvent(`${flagKey} changed to ${value} in the browser`, 'info', {
        event: 'flag_change',
        value,
        flag: flagKey,
      });
    };

    client.on(eventName, onChange);
    setEntries([{ at: new Date().toISOString(), value: lastValue, source: 'initial' }]);
    if (!pageLoadLogged.has(flagKey)) {
      pageLoadLogged.add(flagKey);
      logFlagEvent(`${flagKey} evaluated as ${lastValue} on page load`, 'info', {
        event: 'flag_initial',
        value: lastValue,
        flag: flagKey,
      });
    }

    // Always unsubscribe on unmount to avoid leaks.
    return () => client.off(eventName, onChange);
  }, [client, flagKey]);

  return (
    <div className="card">
      <div className="card-head">
        <h3>Client listener</h3>
        <span className={`pill ${current ? 'on' : 'off'}`}>{current ? 'Released' : 'Rolled back'}</span>
      </div>
      <p className="muted small">
        <code>client.on('change:{flagKey}')</code> in this browser
      </p>
      <ul className="log">
        {entries.map((e) => (
          <li key={e.at + e.source}>
            <time>{new Date(e.at).toLocaleTimeString()}</time>
            <span className={`dot ${e.value ? 'on' : 'off'}`} />
            {e.source === 'initial' ? 'Initial value' : 'Flag changed'} → <strong>{String(e.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
