import { useEffect, useState } from 'react';
import { FLAG_KEYS } from '../ld/flags';

interface ServerEvent {
  key: string;
  value: boolean;
  at: string;
  reason: 'initial' | 'update';
}

/**
 * Shows the *server-side* listener. The Express API subscribes to
 * `ldClient.on('update:insights-dashboard')` with the Node SDK and pushes each
 * change to the browser over Server-Sent Events. Seeing both logs move at the
 * same moment proves the whole stack flipped - not just the UI.
 */
export function ServerStatus() {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource('/api/flag-events');
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as ServerEvent;
      setEvents((prev) => [event, ...prev].slice(0, 20));
    };
    return () => source.close();
  }, []);

  const latest = events[0];

  return (
    <div className="card">
      <div className="card-head">
        <h3>Server listener</h3>
        <span className={`pill ${connected ? 'on' : 'off'}`}>{connected ? 'SSE connected' : 'disconnected'}</span>
      </div>
      <p className="muted small">
        <code>ldClient.on('update:{FLAG_KEYS.INSIGHTS_DASHBOARD}')</code> in the Node API
      </p>
      {latest && (
        <p>
          Server currently serves: <strong>{latest.value ? 'Insights dashboard' : 'usage table'}</strong>
        </p>
      )}
      <ul className="log">
        {events.map((e) => (
          <li key={e.at + e.reason}>
            <time>{new Date(e.at).toLocaleTimeString()}</time>
            <span className={`dot ${e.value ? 'on' : 'off'}`} />
            {e.reason === 'initial' ? 'Initial value' : 'Flag changed'} → <strong>{String(e.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
