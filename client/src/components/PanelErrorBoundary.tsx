import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FLAG_KEYS } from '../ld/flags';
import { trackInsightsCrash } from '../ld/metrics';
import { logFlagEvent, recordFlagError } from '../ld/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches a crash inside the Insights dashboard so the rest of the page
 * keeps working, and tells LaunchDarkly about it two ways:
 *
 *  - `recordFlagError` / `logFlagEvent`: the error (with session replay) and a
 *    log line under the flag's Monitoring tab, so an operator can see it.
 *  - `trackInsightsCrash`: the `insights-dashboard-crash` metric event. A
 *    *guarded rollout* on the flag watches that metric for both variations and
 *    rolls the flag off on its own when the new dashboard regresses. That is
 *    the remediation path: LaunchDarkly decides, no webhook in our code.
 *
 * Because <FeatureGate> only renders this boundary while the flag is ON, a
 * rollback unmounts it and a re-release mounts a fresh instance - no manual
 * reset needed. A human can still short-circuit with `npm run remediate`.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[InsightsDashboard] crashed:', error, info.componentStack);
    logFlagEvent(`Insights dashboard crashed: ${error.message}`, 'error', {
      event: 'crash',
      value: true,
      component: 'InsightsDashboard',
    });
    recordFlagError(error, 'Insights dashboard failed to render', {
      event: 'crash',
      value: true,
      component: 'InsightsDashboard',
    });
    // Metric event for the guarded rollout (LaunchDarkly's own remediation path).
    trackInsightsCrash(error.message);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="panel crashed" role="alert">
        <div className="panel-head">
          <h2>Insights dashboard failed to render</h2>
          <span className="tag danger">Incident</span>
        </div>
        <pre className="stack">{error.message}</pre>
        <p>
          The crash was recorded in LaunchDarkly Observability and sent as the <code>insights-dashboard-crash</code> metric.
          With a guarded rollout on <code>{FLAG_KEYS.INSIGHTS_DASHBOARD}</code>, LaunchDarkly compares the crash rate of this
          dashboard with the usage table and turns the flag off by itself once the regression is clear - this page then rolls
          back with no reload.
        </p>
        <p className="muted">
          To roll back right now instead: run <code>npm run remediate</code> (fires the flag trigger with curl) or toggle the
          flag off in LaunchDarkly.
        </p>
      </section>
    );
  }
}
