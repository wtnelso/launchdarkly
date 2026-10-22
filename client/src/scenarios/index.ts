import { useEffect, useState, type ComponentType } from 'react';
import { Part1Admin } from './part1/Part1Admin';
import { Part1View } from './part1/Part1View';
import { Part2Admin } from './part2/Part2Admin';
import { Part2View } from './part2/Part2View';
import { Part3Admin } from './part3/Part3Admin';
import { Part4Admin } from './part4/Part4Admin';
import { Part4View } from './part4/Part4View';

export interface Scenario {
  id: string;
  label: string;
  View: ComponentType;
  Admin: ComponentType;
}

export const SCENARIOS: Scenario[] = [
  { id: 'part-1', label: 'Part 1 · Release & Remediate', View: Part1View, Admin: Part1Admin },
  { id: 'part-2', label: 'Part 2 · Target', View: Part2View, Admin: Part2Admin },
  { id: 'part-3', label: 'Part 3 · Experiment', View: Part2View, Admin: Part3Admin },
  { id: 'part-4', label: 'Part 4 · AI Config', View: Part4View, Admin: Part4Admin },
];

function fromHash(): Scenario {
  const id = window.location.hash.replace(/^#/, '');
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

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
