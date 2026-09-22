/** Hauteur : conversion entre pas, index de hauteur, MIDI et fréquence. */
import type { OctaveOffset, PitchClass, Step } from './types';

/** Octave de base : C2. Avec le décalage ±1, la plage jouable est C1–B3. */
export const BASE_OCTAVE_MIDI = 36;
export const PITCH_RANGE_SEMITONES = 36;

export const NOTE_NAMES: readonly string[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export type Pitch = Pick<Step, 'note' | 'octave'>;

export function pitchToMidi(pitch: Pitch): number {
  return BASE_OCTAVE_MIDI + pitch.octave * 12 + pitch.note;
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Index continu 0 → PITCH_RANGE_SEMITONES − 1 sur les trois octaves, pour l'édition au drag. */
export function pitchToIndex(pitch: Pitch): number {
  return (pitch.octave + 1) * 12 + pitch.note;
}

export function indexToPitch(index: number): Pitch {
  const clamped = Math.min(PITCH_RANGE_SEMITONES - 1, Math.max(0, Math.round(index)));
  return {
    note: (clamped % 12) as PitchClass,
    octave: (Math.floor(clamped / 12) - 1) as OctaveOffset,
  };
}

/** Nom scientifique, ex. « C2 », « D#3 ». */
export function pitchLabel(pitch: Pitch): string {
  return `${NOTE_NAMES[pitch.note] ?? '?'}${2 + pitch.octave}`;
}
