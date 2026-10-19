import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SetupRequired } from './components/SetupRequired';
import { createProvider, isLaunchDarklyConfigured } from './ld/provider';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

if (!isLaunchDarklyConfigured) {
  // No client-side ID yet: show instructions instead of crashing.
  root.render(
    <StrictMode>
      <SetupRequired />
    </StrictMode>,
  );
} else {
  // LDProvider (see src/ld/provider.ts) creates and starts the LaunchDarkly
  // client once for the whole app. Every hook below it shares that client.
  const LDProvider = createProvider();
  root.render(
    <StrictMode>
      <LDProvider>
        <App />
      </LDProvider>
    </StrictMode>,
  );
}
