import { useBoolVariation, useLDClient } from '@launchdarkly/react-sdk';
import { useEffect, useState } from 'react';
import { FLAG_KEYS } from '../ld/flags';

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
export function FlagActivityLog() {
  const client = useLDClient();
  const current = useBoolVariation(FLAG_KEYS.NEW_PRICING_PANEL, false);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const eventName = `change:${FLAG_KEYS.NEW_PRICING_PANEL}`;

    let lastValue = client.boolVariation(FLAG_KEYS.NEW_PRICING_PANEL, false);

    // The change event doesn't carry the value, so read it inside the handler.
    // The SDK also emits the event while it finishes loading flags, so only log
    // when the value actually differs from what we last saw.
    const onChange = () => {
      const value = client.boolVariation(FLAG_KEYS.NEW_PRICING_PANEL, false);
      if (value === lastValue) return;
      lastValue = value;
      const entry: Entry = { at: new Date().toISOString(), value, source: 'stream' };
      setEntries((prev) => [entry, ...prev].slice(0, 20));
    };

    client.on(eventName, onChange);
    setEntries([{ at: new Date().toISOString(), value: lastValue, source: 'initial' }]);

    // Always unsubscribe on unmount to avoid leaks.
    return () => client.off(eventName, onChange);
  }, [client]);

  return (
    <div className="card">
      <div className="card-head">
        <h3>Client listener</h3>
        <span className={`pill ${current ? 'on' : 'off'}`}>{current ? 'Released' : 'Rolled back'}</span>
      </div>
      <p className="muted small">
        <code>client.on('change:{FLAG_KEYS.NEW_PRICING_PANEL}')</code> in this browser
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
