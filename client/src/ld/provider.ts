import Observability from '@launchdarkly/observability';
import { createClient, createLDReactProviderWithClient, type LDContext, type LDReactClient } from '@launchdarkly/react-sdk';
import SessionReplay from '@launchdarkly/session-replay';

// REPLACE ME: VITE_LD_CLIENT_SIDE_ID in client/.env must be your LaunchDarkly client-side ID (not the SDK key).
// Organization settings > Projects > your project > Environments > Client-side ID.
export const clientSideId = import.meta.env.VITE_LD_CLIENT_SIDE_ID?.trim() ?? '';

export const isLaunchDarklyConfigured = clientSideId.length > 0;

export const DEMO_CONTEXT_KEY = 'demo-user-001';

export const demoContext: LDContext = {
  kind: 'user',
  key: DEMO_CONTEXT_KEY,
  name: 'Demo User',
};

let client: LDReactClient | null = null;

export function getLDClient(): LDReactClient {
  if (!client) throw new Error('LaunchDarkly client not created yet - call createProvider() first');
  return client;
}

export function createProvider() {
  client = createClient(clientSideId, demoContext, {
    streaming: true,
    withReasons: true,
    plugins: [
      new Observability({
        networkRecording: { enabled: true, recordHeadersAndBody: true },
      }),
      new SessionReplay({
        privacySetting: 'default',
      }),
    ],
  });
  void client.start();
  return createLDReactProviderWithClient(client);
}
