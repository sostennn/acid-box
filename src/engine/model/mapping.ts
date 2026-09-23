/**
 * Conversion des valeurs normalisées [0, 1] des knobs vers les unités audio.
 * Chaque courbe est nommée pour que son intention soit lisible.
 */
import {
  CUTOFF_MAX_HZ,
  CUTOFF_MIN_HZ,
  DECAY_MAX_S,
  DECAY_MIN_S,
  DRIVE_MAKEUP_EXPONENT,
  DRIVE_MAX_GAIN,
  ENV_MOD_MAX_OCTAVES,
  RESONANCE_Q_MAX_DB,
  RESONANCE_Q_MIN_DB,
  TUNING_RANGE_SEMITONES,
} from './constants';
import type { Normalized } from './types';

/** Interpolation exponentielle : chaque portion du knob multiplie par le même facteur. */
export function expMap(value: Normalized, min: number, max: number): number {
  return min * (max / min) ** value;
}

/**
 * Niveau perçu à peu près linéaire : la loi quadratique rapproche le knob
 * d'un potentiomètre audio sans passer par les décibels.
 */
export function levelToGain(level: Normalized): number {
  return level * level;
}

export function cutoffToHz(cutoff: Normalized): number {
  return expMap(cutoff, CUTOFF_MIN_HZ, CUTOFF_MAX_HZ);
}

/**
 * Q du passe-bas, en dB. Le dB étant déjà logarithmique, la courbe est
 * linéaire : chaque portion du knob ajoute autant de résonance.
 */
export function resonanceToQ(resonance: Normalized): number {
  return RESONANCE_Q_MIN_DB + resonance * (RESONANCE_Q_MAX_DB - RESONANCE_Q_MIN_DB);
}

/** Constante de temps de la décroissance du filtre. */
export function decayToSeconds(decay: Normalized): number {
  return expMap(decay, DECAY_MIN_S, DECAY_MAX_S);
}

/** Pic de l'enveloppe de filtre, en cents au-dessus du cutoff. */
export function envModToCents(envMod: Normalized): number {
  return envMod * ENV_MOD_MAX_OCTAVES * 1200;
}

/** 0.5 = accord de référence. */
export function tuningToCents(tuning: Normalized): number {
  return (tuning - 0.5) * 2 * TUNING_RANGE_SEMITONES * 100;
}

export function driveToPreGain(drive: Normalized): number {
  return expMap(drive, 1, DRIVE_MAX_GAIN);
}

export function driveMakeupGain(preGain: number): number {
  return preGain ** -DRIVE_MAKEUP_EXPONENT;
}
