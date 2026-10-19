import { LDObserve } from '@launchdarkly/observability';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError, type ReportErrorResponse } from '../api';
import { FLAG_KEYS } from '../ld/flags';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  report: ReportErrorResponse | null;
}

/**
 * Catches a crash inside the Insights dashboard so the rest of the page
 * keeps working, then tells the server about it (POST /api/report-error).
 *
 * If the server has a LaunchDarkly flag trigger configured it fires it, the
 * flag turns OFF, and the parent <FeatureGate> swaps back to the usage table
 * automatically. If not, the card tells the operator how to remediate by hand.
 *
 * Because <FeatureGate> only renders this boundary while the flag is ON, a
 * rollback unmounts it and a re-release mounts a fresh instance - no manual
 * reset needed.
 *
 * The crash is also recorded with LaunchDarkly Observability. Errors caught by
 * a boundary are not "uncaught", so the plugin's automatic capture would miss
 * them; recordError makes them show up under Observability > Errors with the
 * session replay attached.
 */
/**
 * React (in development, and under StrictMode) can replay a render that threw,
 * which would call componentDidCatch twice for one crash and fire the kill
 * switch twice. Share one in-flight report per error message for a few
 * seconds so each incident is reported - and the trigger fired - exactly once.
 */
const REPORT_DEDUPE_MS = 5_000;
let lastReport: { message: string; at: number; promise: Promise<ReportErrorResponse> } | null = null;

function reportOnce(message: string): Promise<ReportErrorResponse> {
  const now = Date.now();
  if (lastReport && lastReport.message === message && now - lastReport.at < REPORT_DEDUPE_MS) {
    return lastReport.promise;
  }
  const promise = reportError(FLAG_KEYS.INSIGHTS_DASHBOARD, message);
  lastReport = { message, at: now, promise };
  return promise;
}

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null, report: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[InsightsDashboard] crashed:', error, info.componentStack);
    LDObserve.recordError(error, 'Insights dashboard failed to render', {
      component: 'InsightsDashboard',
      flag: FLAG_KEYS.INSIGHTS_DASHBOARD,
    });
    void reportOnce(error.message).then(
      (report) => this.setState({ report }),
      () => this.setState({ report: { remediated: false, reason: 'Could not reach the API' } }),
    );
  }

  render(): ReactNode {
    const { error, report } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="panel crashed" role="alert">
        <div className="panel-head">
          <h2>Insights dashboard failed to render</h2>
          <span className="tag danger">Incident</span>
        </div>
        <pre className="stack">{error.message}</pre>

        {!report && <p className="muted">Reporting to the analytics API…</p>}

        {report?.remediated && (
          <p className="ok">
            Automatic kill switch fired the LaunchDarkly flag trigger (HTTP {report.triggerStatus}). The flag is
            turning off - this page will roll back to the usage table in a moment, with no reload.
          </p>
        )}

        {report && !report.remediated && (
          <div>
            <p>
              <strong>No automatic trigger configured.</strong> {report.reason}
            </p>
            <p>Remediate manually - any one of these rolls every user back instantly:</p>
            <ol>
              <li>
                Run <code>npm run remediate</code> (fires the flag trigger with curl)
              </li>
              <li>
                Run <code>npm run remediate:api</code> (REST API fallback)
              </li>
              <li>
                Toggle <code>{FLAG_KEYS.INSIGHTS_DASHBOARD}</code> off in the LaunchDarkly UI
              </li>
            </ol>
          </div>
        )}
      </section>
    );
  }
}
