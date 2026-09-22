import { describe, expect, it } from 'vitest';
import { SHUFFLE_MAX_RATIO } from '../model/constants';
import { shuffleOffsetSeconds, stepDurationSeconds, wrapStepIndex } from './timing';

describe('stepDurationSeconds', () => {
  it('donne la durée d’une double-croche', () => {
    expect(stepDurationSeconds(120)).toBeCloseTo(0.125, 10);
    expect(stepDurationSeconds(60)).toBeCloseTo(0.25, 10);
    expect(stepDurationSeconds(240)).toBeCloseTo(0.0625, 10);
  });
});

describe('shuffleOffsetSeconds', () => {
  it('ne décale jamais les pas pairs', () => {
    for (const step of [0, 2, 4, 14] as const) {
      expect(shuffleOffsetSeconds(step, 1, 0.125)).toBe(0);
    }
  });

  it('retarde les pas impairs proportionnellement, borné par SHUFFLE_MAX_RATIO', () => {
    expect(shuffleOffsetSeconds(1, 0, 0.125)).toBe(0);
    expect(shuffleOffsetSeconds(1, 0.5, 0.125)).toBeCloseTo(0.5 * SHUFFLE_MAX_RATIO * 0.125, 10);
    expect(shuffleOffsetSeconds(15, 1, 0.125)).toBeCloseTo(SHUFFLE_MAX_RATIO * 0.125, 10);
    expect(shuffleOffsetSeconds(1, 1, 0.125)).toBeLessThan(0.125);
  });
});

describe('wrapStepIndex', () => {
  it('boucle sur 16 pas dans les deux sens', () => {
    expect(wrapStepIndex(16)).toBe(0);
    expect(wrapStepIndex(17)).toBe(1);
    expect(wrapStepIndex(-1)).toBe(15);
  });
});
