import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LDProvider } from './ld/provider';
import './styles.css';

// LDProvider (see src/ld/provider.ts) creates and starts the LaunchDarkly
// client once for the whole app. Every hook below it shares that client.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LDProvider>
      <App />
    </LDProvider>
  </StrictMode>,
);
