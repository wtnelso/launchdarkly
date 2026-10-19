import { useEffect, useState, type ComponentType } from 'react';
import { Part1Admin } from './part1/Part1Admin';
import { Part1View } from './part1/Part1View';
import { Part2Admin } from './part2/Part2Admin';
import { Part2View } from './part2/Part2View';

/**
 * Each part of the exercise is a "scenario": an end-user view (what ABC
 * Company's customers see) and an admin panel (flag logs and demo controls,
 * shown in the collapsible drawer). The picker in the top bar switches
 * between them. Add Part 2 / extra credit here as they are built.
 */
export interface Scenario {
  id: string;
  label: string;
  /** Customer-facing UI for this part. */
  View: ComponentType;
  /** Admin / demo tooling for this part, rendered inside the admin drawer. */
  Admin: ComponentType;
}

export const SCENARIOS: Scenario[] = [
  { id: 'part-1', label: 'Part 1 · Release & Remediate', View: Part1View, Admin: Part1Admin },
  { id: 'part-2', label: 'Part 2 · Target', View: Part2View, Admin: Part2Admin },
];

function fromHash(): Scenario {
  const id = window.location.hash.replace(/^#/, '');
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

/** The selected scenario, kept in the URL hash (#part-1) so it is linkable and survives reloads. */
export function useScenario(): [Scenario, (id: string) => void] {
  const [scenario, setScenario] = useState<Scenario>(fromHash);

  useEffect(() => {
    const onHashChange = () => setScenario(fromHash());
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) window.history.replaceState(null, '', `#${scenario.id}`);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [scenario.id]);

  const select = (id: string) => {
    window.location.hash = id;
  };

  return [scenario, select];
}
