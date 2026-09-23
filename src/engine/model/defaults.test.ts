import { describe, expect, it } from 'vitest';
import { DEFAULT_PATTERN } from './defaults';
import { holdContext } from './pattern';

describe('DEFAULT_PATTERN', () => {
  const line = DEFAULT_PATTERN.bass;

  it('la ligne de départ fait entendre accents et slides dès le premier play', () => {
    expect(line.some((step) => !step.rest && step.accent)).toBe(true);
    expect(line.some((step) => !step.rest && step.slide)).toBe(true);
  });

  it('commence sur la tonique accentuée', () => {
    expect(line[0]).toMatchObject({ note: 0, octave: 0, accent: true, rest: false });
  });

  it('le slide du dernier pas relie la boucle au premier', () => {
    expect(holdContext(line, 0).held).toBe(true);
  });
});
