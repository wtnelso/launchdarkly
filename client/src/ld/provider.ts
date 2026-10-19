/**
 * LaunchDarkly React SDK setup.
 *
 * createLDReactProvider() creates the browser client once, starts it, and
 * returns a React provider. Every variation hook rendered under the provider
 * subscribes to flag changes, and the SDK keeps a streaming connection open to
 * LaunchDarkly, so a toggle in the LaunchDarkly UI re-renders this app in well
 * under a second with no page reload.
 */
import Observability from '@launchdarkly/observability';
import { createLDReactProvider, type LDContext } from '@launchdarkly/react-sdk';
import SessionReplay from '@launchdarkly/session-replay';

// REPLACE ME: set VITE_LD_CLIENT_SIDE_ID in client/.env (see client/.env.example).
// This is the *client-side ID*, not the SDK key. It is safe to ship to browsers.
export const clientSideId = import.meta.env.VITE_LD_CLIENT_SIDE_ID?.trim() ?? '';

/** True when a client-side ID is present. The SDK throws if given an empty one. */
export const isLaunchDarklyConfigured = clientSideId.length > 0;

/**
 * The context LaunchDarkly evaluates flags for.
 *
 * Part 1 only needs a stable identity so the flag's on/off state applies to
 * this browser. Part 2 (targeting) will add attributes such as plan, region
 * and email so individual and rule-based targeting can be demonstrated.
 */
export const DEMO_CONTEXT_KEY = 'demo-user-001';

export const demoContext: LDContext = {
  kind: 'user',
  key: DEMO_CONTEXT_KEY,
  name: 'Demo User',
};

/**
 * Build the provider. Called once from main.tsx, and only when a client-side
 * ID is configured (otherwise main.tsx renders a setup screen instead).
 */
export function createProvider() {
  return createLDReactProvider(clientSideId, demoContext, {
    ldOptions: {
      // Streaming is on by default when a variation hook is used; set explicitly
      // so it's obvious during the demo that real-time updates are intentional.
      streaming: true,
      // LaunchDarkly Observability + Session Replay. They reuse the client-side
      // ID (no extra keys) and send errors, network calls, logs and a replay of
      // the session to LaunchDarkly > Observability. During the demo this is
      // how you show "LaunchDarkly saw the crash" before "LaunchDarkly killed it".
      plugins: [
        new Observability({
          networkRecording: { enabled: true, recordHeadersAndBody: true },
        }),
        new SessionReplay({
          // 'default' masks form inputs but keeps text readable in the replay.
          // 'strict' blanks all text (safer for real customer data, useless for a demo).
          privacySetting: 'default',
        }),
      ],
    },
  });
}
