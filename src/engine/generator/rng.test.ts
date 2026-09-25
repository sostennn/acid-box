import { describe, expect, it } from 'vitest';
import { chance, createRng, pick, randomSeed, toSeed } from './rng';

const draw = (seed: number, count: number) => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
};

describe('createRng', () => {
  it('même seed, même suite', () => {
    expect(draw(42, 50)).toEqual(draw(42, 50));
  });

  it('seeds différentes, suites différentes', () => {
    expect(draw(1, 10)).not.toEqual(draw(2, 10));
  });

  it('reste dans [0, 1[ et couvre l’intervalle', () => {
    const values = draw(7, 10_000);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });

  it('une seed non entière ou hors 32 bits équivaut à sa forme normalisée', () => {
    expect(draw(3.9, 5)).toEqual(draw(3, 5));
    expect(draw(-1, 5)).toEqual(draw(2 ** 32 - 1, 5));
  });
});

describe('toSeed', () => {
  it('rend un entier 32 bits non signé, 0 pour NaN et ±∞', () => {
    expect(toSeed(12.7)).toBe(12);
    expect(toSeed(2 ** 32 + 5)).toBe(5);
    expect(toSeed(NaN)).toBe(0);
    expect(toSeed(Infinity)).toBe(0);
  });
});

describe('randomSeed', () => {
  it('rend un entier 32 bits non signé', () => {
    for (let i = 0; i < 100; i += 1) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });
});

describe('chance', () => {
  it('jamais à 0, toujours à 1', () => {
    const rng = createRng(5);
    for (let i = 0; i < 1000; i += 1) {
      expect(chance(rng, 0)).toBe(false);
      expect(chance(rng, 1)).toBe(true);
    }
  });
});

describe('pick', () => {
  it('tire chaque élément', () => {
    const rng = createRng(9);
    const seen = new Set(Array.from({ length: 200 }, () => pick(rng, ['a', 'b', 'c'])));
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
  });

  it('liste vide : undefined', () => {
    expect(pick(createRng(1), [])).toBeUndefined();
  });
});
