import { describe, expect, it } from 'vitest';
import { DEFAULT_STEP, tuple16 } from './defaults';
import { holdContext } from './pattern';
import type { BassPattern, Step } from './types';

const make = (overrides: Record<number, Partial<Step>>): BassPattern =>
  tuple16((i) => ({ ...DEFAULT_STEP, ...overrides[i] }));

describe('holdContext', () => {
  it('remonte au pas joué précédent, silences sautés', () => {
    const pattern = make({ 1: { rest: true }, 2: { rest: true }, 0: { slide: true, note: 7 } });
    expect(holdContext(pattern, 3)).toEqual({ previousPlayed: pattern[0], held: true });
    expect(holdContext(pattern, 1).previousPlayed).toBe(pattern[0]);
  });

  it('n’est pas tenu si le pas joué précédent ne slide pas', () => {
    const pattern = make({ 4: { rest: true } });
    expect(holdContext(pattern, 5)).toEqual({ previousPlayed: pattern[4 - 1], held: false });
  });

  it('boucle de 0 vers 15', () => {
    const pattern = make({ 15: { slide: true } });
    expect(holdContext(pattern, 0)).toEqual({ previousPlayed: pattern[15], held: true });
  });

  it('un seul pas joué avec slide se lie à lui-même', () => {
    const overrides: Record<number, Partial<Step>> = {};
    for (let i = 0; i < 16; i += 1) overrides[i] = { rest: true };
    overrides[5] = { rest: false, slide: true };
    const pattern = make(overrides);
    expect(holdContext(pattern, 5)).toEqual({ previousPlayed: pattern[5], held: true });
  });

  it('tout silence : aucun pas précédent', () => {
    const overrides: Record<number, Partial<Step>> = {};
    for (let i = 0; i < 16; i += 1) overrides[i] = { rest: true };
    expect(holdContext(make(overrides), 3)).toEqual({ previousPlayed: null, held: false });
  });
});
