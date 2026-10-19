import { useEffect, useState } from 'react';
import { fetchPricing, type PricingResponse } from './api';

/**
 * Loads pricing from the server for the variant this panel expects.
 *
 * The client and server SDKs each hold their own streaming connection to
 * LaunchDarkly, so after a toggle they may learn about the change a few
 * hundred milliseconds apart. If the server's answer doesn't match the panel
 * we're rendering yet, we retry briefly instead of showing mismatched data.
 */
export function usePricing(expectedVariant: PricingResponse['variant']) {
  const [data, setData] = useState<PricingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const load = async () => {
      try {
        const res = await fetchPricing();
        if (cancelled) return;
        if (res.variant !== expectedVariant && attempts < 5) {
          attempts += 1;
          setTimeout(load, 400);
          return;
        }
        setData(res);
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
