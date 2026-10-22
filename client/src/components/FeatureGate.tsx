import { useBoolVariation } from '@launchdarkly/react-sdk';
import { FLAG_KEYS } from '../ld/flags';
import { InsightsDashboard } from './InsightsDashboard';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { UsageReportTable } from './UsageReportTable';

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
