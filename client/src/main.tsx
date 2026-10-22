import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SetupRequired } from './components/SetupRequired';
import { createProvider, isLaunchDarklyConfigured } from './ld/provider';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

if (!isLaunchDarklyConfigured) {
  root.render(
    <StrictMode>
      <SetupRequired />
    </StrictMode>,
  );
} else {
  const LDProvider = createProvider();
  root.render(
    <StrictMode>
      <LDProvider>
        <App />
      </LDProvider>
    </StrictMode>,
  );
}
