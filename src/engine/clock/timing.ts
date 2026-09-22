/** Calculs de temps musical, purs. */
import { SHUFFLE_MAX_RATIO, STEP_COUNT } from '../model/constants';
import type { Normalized, StepIndex } from '../model/types';

/** Durée d'un pas (double-croche) en secondes. */
export function stepDurationSeconds(bpm: number): number {
  return 60 / bpm / 4;
}

/**
 * Décalage de shuffle : les 16es impairs sont retardés, la grille des pas
 * pairs reste droite.
 */
export function shuffleOffsetSeconds(
  step: StepIndex,
  shuffle: Normalized,
  stepDuration: number,
): number {
  return step % 2 === 1 ? shuffle * SHUFFLE_MAX_RATIO * stepDuration : 0;
}

export function wrapStepIndex(step: number): StepIndex {
  return (((step % STEP_COUNT) + STEP_COUNT) % STEP_COUNT) as StepIndex;
}
