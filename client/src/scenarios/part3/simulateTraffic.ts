import { useSyncExternalStore } from 'react';
import { FLAG_KEYS } from '../../ld/flags';
import { trackSyntheticConversion } from '../../ld/metrics';
import { getLDClient } from '../../ld/provider';
import { logFlagEvent } from '../../ld/telemetry';
import { applyPersonaContext } from '../part2/personaStore';
import { randomTimeToClick, randomVisitor } from './syntheticVisitors';

export interface SimConfig {
  visitors: number;
  convClassic: number;
  convV2: number;
}

export interface VariationStats {
  exposures: number;
  conversions: number;
}

export interface SimState {
  status: 'idle' | 'running' | 'flushing' | 'done' | 'cancelled' | 'error';
  done: number;
  total: number;
  classic: VariationStats;
  v2: VariationStats;
  identifyErrors: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export const DEFAULT_SIM: SimConfig = { visitors: 200, convClassic: 0.2, convV2: 0.32 };

const idle = (): SimState => ({
  status: 'idle',
  done: 0,
  total: 0,
  classic: { exposures: 0, conversions: 0 },
  v2: { exposures: 0, conversions: 0 },
  identifyErrors: 0,
});

let state: SimState = idle();
let cancelled = false;
const listeners = new Set<() => void>();

function set(patch: Partial<SimState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useSimulation(): SimState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function cancelSimulation(): void {
  cancelled = true;
}

export async function runSimulation(config: SimConfig): Promise<void> {
  if (state.status === 'running' || state.status === 'flushing') return;
  cancelled = false;
  const client = getLDClient();
  const total = Math.max(1, Math.min(2000, Math.round(config.visitors)));
  state = { ...idle(), status: 'running', total, startedAt: Date.now() };
  set({});

  try {
    for (let i = 0; i < total; i++) {
      if (cancelled) break;
      const visitor = randomVisitor();
      const result = await client.identify(visitor, { sheddable: false });
      if (result.status !== 'completed') {
        set({ identifyErrors: state.identifyErrors + 1, done: i + 1 });
        continue;
      }
      const v2 = client.boolVariation(FLAG_KEYS.LANDING_HERO_V2, false);
      const hero = v2 ? 'v2' : 'classic';
      const stats = { ...state[hero], exposures: state[hero].exposures + 1 };
      if (Math.random() < (v2 ? config.convV2 : config.convClassic)) {
        trackSyntheticConversion(hero, randomTimeToClick(hero));
        stats.conversions += 1;
      }
      set({ [hero]: stats, done: i + 1 });
    }

    set({ status: 'flushing' });
    await client.flush();
    const summary =
      `Simulated ${state.done} visitors from the browser: classic ${state.classic.conversions}/${state.classic.exposures}, ` +
      `v2 ${state.v2.conversions}/${state.v2.exposures} conversions`;
    await applyPersonaContext();
    logFlagEvent(summary, 'info', {
      flag: FLAG_KEYS.LANDING_HERO_V2,
      event: 'traffic_simulation',
      value: client.boolVariation(FLAG_KEYS.LANDING_HERO_V2, false),
      tier: 'browser',
      visitors: state.done,
      classic_exposures: state.classic.exposures,
      classic_conversions: state.classic.conversions,
      v2_exposures: state.v2.exposures,
      v2_conversions: state.v2.conversions,
    });
    set({ status: cancelled ? 'cancelled' : 'done', finishedAt: Date.now() });
  } catch (err) {
    set({ status: 'error', error: err instanceof Error ? err.message : String(err), finishedAt: Date.now() });
    await applyPersonaContext().catch(() => undefined);
  }
}
