/**
 * Conversion des valeurs normalisées [0, 1] des knobs vers les unités audio.
 * Chaque courbe est nommée pour que son intention soit lisible.
 */
import type { Normalized } from './types';

/**
 * Niveau perçu à peu près linéaire : la loi quadratique rapproche le knob
 * d'un potentiomètre audio sans passer par les décibels.
 */
export function levelToGain(level: Normalized): number {
  return level * level;
}
