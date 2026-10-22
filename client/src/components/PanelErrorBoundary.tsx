import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError, type ReportErrorResponse } from '../api';
import { FLAG_KEYS } from '../ld/flags';
import { trackInsightsCrash } from '../ld/metrics';
import { logFlagEvent, recordFlagError } from '../ld/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  report: ReportErrorResponse | null;
}

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
    trackInsightsCrash(error.message);
    void reportOnce(error.message).then(
      (report) => {
        this.setState({ report });
        logFlagEvent(
          report.remediated
            ? `Kill switch fired: flag trigger answered HTTP ${report.triggerStatus}`
            : `Crash reported, no automatic kill switch: ${report.reason ?? 'unknown'}`,
          'warn',
          { event: report.remediated ? 'kill_switch' : 'kill_switch_unavailable', value: true },
        );
      },
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
