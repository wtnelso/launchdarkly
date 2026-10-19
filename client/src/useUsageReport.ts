import { useEffect, useState } from 'react';
import { fetchUsageReport, type UsageReport } from './api';

/**
 * Loads the usage report from the server for the variant this view expects.
 *
 * The client and server SDKs each hold their own streaming connection to
 * LaunchDarkly, so after a toggle they may learn about the change a few
 * hundred milliseconds apart. If the server's answer doesn't match the view
 * we're rendering yet, we retry briefly instead of showing mismatched data.
 */
export function useUsageReport<V extends UsageReport['variant']>(expectedVariant: V) {
  const [data, setData] = useState<Extract<UsageReport, { variant: V }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const load = async () => {
      try {
        const res = await fetchUsageReport();
        if (cancelled) return;
        if (res.variant !== expectedVariant) {
          if (attempts < 5) {
            attempts += 1;
            setTimeout(load, 400);
          }
          return;
        }
        setData(res as Extract<UsageReport, { variant: V }>);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [expectedVariant]);

  return { data, error };
}
