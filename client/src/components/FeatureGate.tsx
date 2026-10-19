import { useBoolVariation } from '@launchdarkly/react-sdk';
import { FLAG_KEYS } from '../ld/flags';
import { LegacyPricingPanel } from './LegacyPricingPanel';
import { NewPricingPanel } from './NewPricingPanel';
import { PanelErrorBoundary } from './PanelErrorBoundary';

/**
 * The feature flag in action.
 *
 * useBoolVariation() evaluates `new-pricing-panel` for the current context AND
 * subscribes this component to changes. When someone toggles the flag in
 * LaunchDarkly (or a trigger turns it off), the SDK's streaming connection
 * delivers the new value and React re-renders the other branch immediately -
 * that is the "instant release / rollback" with no page reload.
 *
 * The second argument is the fallback used if LaunchDarkly is unreachable or
 * the flag doesn't exist: we fail closed to the legacy panel.
 */
export function FeatureGate() {
  const newPanelEnabled = useBoolVariation(FLAG_KEYS.NEW_PRICING_PANEL, false);

  if (newPanelEnabled) {
    return (
      <PanelErrorBoundary>
        <NewPricingPanel />
      </PanelErrorBoundary>
    );
  }

  return <LegacyPricingPanel />;
}
