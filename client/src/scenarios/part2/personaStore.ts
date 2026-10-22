import { useSyncExternalStore } from 'react';
import { FLAG_KEYS } from '../../ld/flags';
import { getLDClient } from '../../ld/provider';
import { logFlagEvent } from '../../ld/telemetry';
import { contextFor, findPersona, type Persona } from './personas';

const STORAGE_KEY = 'abc.persona';
const listeners = new Set<() => void>();

function readPersisted(): Persona {
  try {
    return findPersona(localStorage.getItem(STORAGE_KEY));
  } catch {
    return findPersona(null);
  }
}

let current: Persona = readPersisted();
let identifying = false;

function notify(): void {
  for (const l of listeners) l();
}

export function getPersona(): Persona {
  return current;
}

export function usePersona(): Persona {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPersona,
  );
}

export function useIdentifying(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => identifying,
  );
}

export async function applyPersonaContext(): Promise<void> {
  identifying = true;
  notify();
  try {
    await getLDClient().identify(contextFor(current));
  } finally {
    identifying = false;
    notify();
  }
}

export async function setPersona(id: string): Promise<void> {
  current = findPersona(id);
  try {
    localStorage.setItem(STORAGE_KEY, current.id);
  } catch {
    return;
  }
  notify();
  await applyPersonaContext();
  const value = getLDClient().boolVariation(FLAG_KEYS.LANDING_HERO_V2, false);
  logFlagEvent(`Identified as ${current.label} (${current.user.key}); landing-hero-v-2 = ${value}`, 'info', {
    flag: FLAG_KEYS.LANDING_HERO_V2,
    event: 'persona_switch',
    value,
    persona: current.id,
  });
}
