import { describe, expect, it } from 'vitest';
import { DEFAULT_DRUM_PATTERN, DEFAULT_PATTERN } from './defaults';
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

describe('DEFAULT_DRUM_PATTERN', () => {
  const active = (row: readonly number[]) =>
    row.flatMap((velocity, index) => (velocity > 0 ? [index] : []));

  it('kick sur les quatre temps, clap sur 2 et 4', () => {
    expect(active(DEFAULT_DRUM_PATTERN.kick)).toEqual([0, 4, 8, 12]);
    expect(active(DEFAULT_DRUM_PATTERN.clap)).toEqual([4, 12]);
  });

  it('chaque hat ouvert est étouffé par un hat fermé au 16e suivant', () => {
    const open = active(DEFAULT_DRUM_PATTERN.openHat);
    expect(open.length).toBeGreaterThan(0);
    for (const index of open) expect(DEFAULT_DRUM_PATTERN.closedHat[index + 1]).toBeGreaterThan(0);
  });
});
