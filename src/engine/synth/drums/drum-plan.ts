/**
 * Ce que doit jouer une frappe, décidé sans Web Audio : la vélocité donne le
 * niveau et raccourcit un peu la queue des frappes douces.
 */
import { DRUM_VELOCITY_DECAY_SPREAD } from '../../model/constants';
import { levelToGain } from '../../model/mapping';
import type { Velocity } from '../../model/types';

export interface DrumHitSpec {
  /** Pic de l'enveloppe d'amplitude. */
  readonly gain: number;
  /** Facteur appliqué aux constantes de temps de la queue, dans ]0, 1]. */
  readonly decayScale: number;
}

/** null : rien à jouer (pas inactif ou voix mutée). */
export function planDrumHit(velocity: Velocity, muted: boolean): DrumHitSpec | null {
  if (muted || !(velocity > 0)) return null;
  const v = Math.min(1, velocity);
  return {
    // Même loi que les niveaux : une vélocité à mi-course sonne à mi-course.
    gain: levelToGain(v),
    decayScale: 1 - DRUM_VELOCITY_DECAY_SPREAD * (1 - v),
  };
}
