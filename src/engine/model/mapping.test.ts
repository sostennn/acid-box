import { describe, expect, it } from 'vitest';
import { levelToGain } from './mapping';

describe('levelToGain', () => {
  it('va de 0 à 1 de façon monotone et quadratique', () => {
    expect(levelToGain(0)).toBe(0);
    expect(levelToGain(1)).toBe(1);
    expect(levelToGain(0.5)).toBeCloseTo(0.25, 10);
    let previous = -1;
    for (let i = 0; i <= 10; i += 1) {
      const gain = levelToGain(i / 10);
      expect(gain).toBeGreaterThan(previous);
      previous = gain;
    }
  });
});
