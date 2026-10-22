import { useBoolVariation, useLDClient } from '@launchdarkly/react-sdk';
import { useEffect, useState } from 'react';
import { FLAG_KEYS, type FlagKey } from '../ld/flags';
import { logFlagEvent } from '../ld/telemetry';

const pageLoadLogged = new Set<string>();

interface Entry {
  at: string;
  value: boolean;
  source: 'initial' | 'stream';
}

export function FlagActivityLog({ flagKey = FLAG_KEYS.INSIGHTS_DASHBOARD }: { flagKey?: FlagKey }) {
  const client = useLDClient();
  const current = useBoolVariation(flagKey, false);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const eventName = `change:${flagKey}`;

    let lastValue = client.boolVariation(flagKey, false);

    const onChange = () => {
      const value = client.boolVariation(flagKey, false);
      if (value === lastValue) return;
      lastValue = value;
      const entry: Entry = { at: new Date().toISOString(), value, source: 'stream' };
      setEntries((prev) => [entry, ...prev].slice(0, 20));
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
