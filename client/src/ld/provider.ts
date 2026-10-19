/**
 * LaunchDarkly React SDK setup.
 *
 * createLDReactProvider() creates the browser client once, starts it, and
 * returns a React provider. Every variation hook rendered under the provider
 * subscribes to flag changes, and the SDK keeps a streaming connection open to
 * LaunchDarkly, so a toggle in the LaunchDarkly UI re-renders this app in well
 * under a second with no page reload.
 */
import { createLDReactProvider, type LDContext } from '@launchdarkly/react-sdk';

// REPLACE ME: set VITE_LD_CLIENT_SIDE_ID in client/.env (see client/.env.example).
// This is the *client-side ID*, not the SDK key. It is safe to ship to browsers.
const clientSideId = import.meta.env.VITE_LD_CLIENT_SIDE_ID;

export const isLaunchDarklyConfigured = Boolean(clientSideId);

/**
 * The context LaunchDarkly evaluates flags for.
 *
 * Part 1 only needs a stable identity so the flag's on/off state applies to
 * this browser. Part 2 (targeting) will add attributes such as plan, region
 * and email so individual and rule-based targeting can be demonstrated.
 */
export const demoContext: LDContext = {
  kind: 'user',
  key: 'demo-user-001',
  name: 'Demo User',
};

export const LDProvider = createLDReactProvider(clientSideId ?? 'missing-client-side-id', demoContext, {
  ldOptions: {
    // Streaming is on by default when a variation hook is used; set explicitly
    // so it's obvious during the demo that real-time updates are intentional.
    streaming: true,
  },
});
