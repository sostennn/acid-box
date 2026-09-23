/** Lectures pures du pattern, partagées par le moteur et l'interface. */
import { STEP_COUNT } from './constants';
import type { BassPattern, Step, StepIndex } from './types';

export interface HoldContext {
  /** Dernier pas joué avant celui-ci en remontant à travers les silences ; peut être lui-même. */
  readonly previousPlayed: Step | null;
  /** Vrai si ce pas hérite de la note en cours : le pas joué précédent porte un slide. */
  readonly held: boolean;
}

export function holdContext(pattern: BassPattern, index: StepIndex): HoldContext {
  for (let k = 1; k <= STEP_COUNT; k += 1) {
    const candidate = pattern[(((index - k) % STEP_COUNT) + STEP_COUNT) % STEP_COUNT];
    if (candidate !== undefined && !candidate.rest) {
      return { previousPlayed: candidate, held: candidate.slide };
    }
  }
  return { previousPlayed: null, held: false };
}
