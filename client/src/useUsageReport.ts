import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchUsageReport, type UsageReport } from './api';

interface Options {
  /** Re-fetch on this interval (ms). Omit for fetch-on-mount only. */
  refreshMs?: number;
}

/**
 * Loads the usage report from the server for the variant this view expects.
 *
 * The client and server SDKs each hold their own streaming connection to
 * LaunchDarkly, so after a toggle they may learn about the change a few
 * hundred milliseconds apart. If the server's answer doesn't match the view
 * we're rendering yet, we retry briefly instead of showing mismatched data.
 */
export function useUsageReport<V extends UsageReport['variant']>(expectedVariant: V, { refreshMs }: Options = {}) {
  const [data, setData] = useState<Extract<UsageReport, { variant: V }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const myGen = ++generation.current;
    let attempts = 0;
    const attempt = async (): Promise<void> => {
      try {
        const res = await fetchUsageReport();
        if (myGen !== generation.current) return; // superseded by a newer load or unmount
        if (res.variant !== expectedVariant) {
          if (attempts < 5) {
            attempts += 1;
            setTimeout(attempt, 400);
          }
          return;
        }
        setData(res as Extract<UsageReport, { variant: V }>);
        setUpdatedAt(new Date());
        setError(null);
      } catch (err) {
        if (myGen === generation.current) setError(err instanceof Error ? err.message : String(err));
      }
    };
    await attempt();
  }, [expectedVariant]);

  useEffect(() => {
    void load();
    const timer = refreshMs ? setInterval(() => void load(), refreshMs) : undefined;
    return () => {
      generation.current += 1; // cancel in-flight work
      if (timer) clearInterval(timer);
    };
  }, [load, refreshMs]);

  return { data, error, updatedAt, refresh: load };
}
