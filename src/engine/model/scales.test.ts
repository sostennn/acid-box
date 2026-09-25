import { describe, expect, it } from 'vitest';
import { SCALE_IDS, scalePitchClasses } from './scales';
import type { PitchClass } from './types';

const ROOTS = Array.from({ length: 12 }, (_, i) => i as PitchClass);

describe('scalePitchClasses', () => {
  it('Do mineur et Do phrygien', () => {
    expect(scalePitchClasses('minor', 0)).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(scalePitchClasses('phrygian', 0)).toEqual([0, 1, 3, 5, 7, 8, 10]);
  });

  it('transpose en repliant sur l’octave', () => {
    expect(scalePitchClasses('minor', 9)).toEqual([9, 11, 0, 2, 4, 5, 7]);
  });

  it('pour toute tonique : sept notes distinctes, tonique en premier', () => {
    for (const scale of SCALE_IDS) {
      for (const root of ROOTS) {
        const notes = scalePitchClasses(scale, root);
        expect(notes[0]).toBe(root);
        expect(new Set(notes).size).toBe(7);
        for (const note of notes) expect(note).toBeGreaterThanOrEqual(0);
        for (const note of notes) expect(note).toBeLessThan(12);
      }
    }
  });
});
