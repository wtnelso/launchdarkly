import { useUsageReport } from '../useUsageReport';

export function UsageReportTable() {
  const { data, error } = useUsageReport('legacy');

  const exportCsv = () => {
    if (!data) return;
    const header = 'month,active_users,api_calls,storage_gb';
    const rows = data.months.map((m) => `${m.month},${m.activeUsers},${m.apiCalls},${m.storageGb}`);
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'abc-usage-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel report" aria-labelledby="report-title">
      <div className="panel-head">
        <div>
          <p className="crumbs muted small">Reports › Usage</p>
          <h2 id="report-title">Monthly usage</h2>
          <p className="muted">Last six months, updated nightly.</p>
        </div>
        <button className="btn btn-outline" onClick={exportCsv} disabled={!data}>
          Export CSV
        </button>
      </div>

      {error && <p className="error">Could not load the report: {error}</p>}
      {!data && !error && <p className="muted">Loading report…</p>}

      {data && (
        <table className="report-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Active users</th>
              <th className="num">API calls</th>
              <th className="num">Storage (GB)</th>
            </tr>
          </thead>
          <tbody>
            {data.months.map((m) => (
              <tr key={m.month}>
                <td>{formatMonth(m.month)}</td>
                <td className="num">{m.activeUsers.toLocaleString()}</td>
                <td className="num">{m.apiCalls.toLocaleString()}</td>
                <td className="num">{m.storageGb.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
