/**
 * Générateur pseudo-aléatoire seedable : à seed égale, même suite, donc même
 * ligne générée. Seul module du moteur autorisé à appeler `Math.random`.
 */

export interface Rng {
  /** Flottant uniforme dans [0, 1[. */
  next(): number;
}

const UINT32_RANGE = 2 ** 32;

/** mulberry32 : 32 bits d'état, suffisant pour tirer quelques dizaines de valeurs par ligne. */
export function createRng(seed: number): Rng {
  let state = toSeed(seed);
  return {
    next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
    },
  };
}

/** Ramène n'importe quel nombre à un entier 32 bits non signé ; `NaN` et ±∞ donnent 0. */
export function toSeed(value: number): number {
  return Math.trunc(value) >>> 0;
}

export function randomSeed(): number {
  return toSeed(Math.random() * UINT32_RANGE);
}

/** Vrai avec la probabilité `p` : jamais à 0, toujours à 1. */
export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

/** Élément uniforme de `items`, `undefined` si la liste est vide. */
export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  return items[Math.floor(rng.next() * items.length)];
}
