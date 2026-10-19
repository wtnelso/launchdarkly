import { useBoolVariation } from '@launchdarkly/react-sdk';
import { FLAG_KEYS } from '../ld/flags';
import { InsightsDashboard } from './InsightsDashboard';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { UsageReportTable } from './UsageReportTable';

/**
 * The feature flag in action.
 *
 * useBoolVariation() evaluates `insights-dashboard` for the current context AND
 * subscribes this component to changes. When someone toggles the flag in
 * LaunchDarkly (or a trigger turns it off), the SDK's streaming connection
 * delivers the new value and React re-renders the other branch immediately -
 * that is the "instant release / rollback" with no page reload.
 *
 * The second argument is the fallback used if LaunchDarkly is unreachable or
 * the flag doesn't exist: we fail closed to the legacy usage table.
 */
export function FeatureGate() {
  const insightsEnabled = useBoolVariation(FLAG_KEYS.INSIGHTS_DASHBOARD, false);

  if (insightsEnabled) {
    return (
      <PanelErrorBoundary>
        <InsightsDashboard />
      </PanelErrorBoundary>
    );
  }

  return <UsageReportTable />;
}
