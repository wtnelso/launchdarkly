import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Shared state for demo-only controls that live in the admin drawer but act on
 * the end-user view (e.g. "Simulate production bug" makes the new pricing
 * panel throw during render).
 */
interface DemoControls {
  /** When true, NewPricingPanel throws on its next render. */
  crashNewPanel: boolean;
  setCrashNewPanel: (value: boolean) => void;
}

const DemoControlsContext = createContext<DemoControls | null>(null);

export function DemoControlsProvider({ children }: { children: ReactNode }) {
  const [crashNewPanel, setCrashNewPanel] = useState(false);
  const value = useMemo(() => ({ crashNewPanel, setCrashNewPanel }), [crashNewPanel]);
  return <DemoControlsContext.Provider value={value}>{children}</DemoControlsContext.Provider>;
}

export function useDemoControls(): DemoControls {
  const ctx = useContext(DemoControlsContext);
  if (!ctx) throw new Error('useDemoControls must be used inside <DemoControlsProvider>');
  return ctx;
}
