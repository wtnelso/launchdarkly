import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchUsageReport, type UsageReport } from './api';

interface Options {
  refreshMs?: number;
}

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
        if (myGen !== generation.current) return;
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
      generation.current += 1;
      if (timer) clearInterval(timer);
    };
  }, [load, refreshMs]);

  return { data, error, updatedAt, refresh: load };
}
