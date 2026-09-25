/** Gammes du générateur, en intervalles depuis la tonique. */
import type { PitchClass, ScaleId } from './types';

export const SCALE_IDS: readonly ScaleId[] = ['minor', 'phrygian'];

const SCALE_INTERVALS: Readonly<Record<ScaleId, readonly number[]>> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  // Seconde mineure : la couleur sombre et tendue de beaucoup de lignes acid.
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

/** Classes de hauteur de la gamme, tonique en premier. */
export function scalePitchClasses(scale: ScaleId, root: PitchClass): readonly PitchClass[] {
  return SCALE_INTERVALS[scale].map((interval) => ((root + interval) % 12) as PitchClass);
}
