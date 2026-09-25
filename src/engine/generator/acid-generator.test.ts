import { describe, expect, it } from 'vitest';
import { GENERATOR_OCTAVE_UP_RATIO, GENERATOR_TONIC_WEIGHT } from '../model/constants';
import { DEFAULT_GENERATOR } from '../model/defaults';
import { SCALE_IDS, scalePitchClasses } from '../model/scales';
import type { BassPattern, PitchClass, Step } from '../model/types';
import { generateAcidLine, type LineParams } from './acid-generator';

const DRAWS = 200;
const TOLERANCE = 0.05;
const SEEDS = Array.from({ length: DRAWS }, (_, i) => i);

const params = (patch: Partial<LineParams> = {}): LineParams => ({
  ...DEFAULT_GENERATOR,
  ...patch,
});

const lines = (patch: Partial<LineParams>): BassPattern[] =>
  SEEDS.map((seed) => generateAcidLine(params(patch), seed));

/** Pas joués hors du pas 0, qui est imposé. */
const drawnNotes = (patch: Partial<LineParams>): Step[] =>
  lines(patch).flatMap((line) => line.slice(1).filter((step) => !step.rest));

const share = <T>(items: readonly T[], predicate: (item: T) => boolean) =>
  items.filter(predicate).length / items.length;

const expectNear = (observed: number, expected: number) =>
  expect(Math.abs(observed - expected)).toBeLessThan(TOLERANCE);

describe('generateAcidLine', () => {
  it('même seed et mêmes paramètres, même ligne', () => {
    expect(generateAcidLine(params(), 1234)).toEqual(generateAcidLine(params(), 1234));
    expect(generateAcidLine(params(), 1)).not.toEqual(generateAcidLine(params(), 2));
  });

  it('le pas 0 est la tonique, jouée à l’octave de base', () => {
    for (const scale of SCALE_IDS) {
      for (const root of [0, 5, 11] as const) {
        for (const line of lines({ scale, root, noteDensity: 0.5, octaveJumpDensity: 1 })) {
          expect(line[0]).toMatchObject({ note: root, octave: 0, rest: false });
        }
      }
    }
  });

  it('toutes les notes jouées sont dans la gamme', () => {
    for (const scale of SCALE_IDS) {
      const root: PitchClass = 2;
      const allowed = new Set(scalePitchClasses(scale, root));
      for (const step of drawnNotes({ scale, root, noteDensity: 1 })) {
        expect(allowed.has(step.note)).toBe(true);
      }
    }
  });

  it('densités observées sur 200 tirages', () => {
    const patch = {
      noteDensity: 0.6,
      accentDensity: 0.3,
      slideDensity: 0.4,
      octaveJumpDensity: 0.25,
    };
    const all = lines(patch).flatMap((line) => line.slice(1));
    expectNear(
      share(all, (step) => !step.rest),
      patch.noteDensity,
    );

    const notes = drawnNotes(patch);
    expectNear(
      share(notes, (s) => s.accent),
      patch.accentDensity,
    );
    expectNear(
      share(notes, (s) => s.octave !== 0),
      patch.octaveJumpDensity,
    );

    // Sans silence, aucun slide n'est retiré par l'heuristique.
    const dense = drawnNotes({ ...patch, noteDensity: 1 });
    expectNear(
      share(dense, (s) => s.slide),
      patch.slideDensity,
    );
  });

  it('densité 0 : la tonique seule, sans aucun drapeau', () => {
    for (const line of lines({
      noteDensity: 0,
      accentDensity: 0,
      slideDensity: 0,
      octaveJumpDensity: 0,
    })) {
      expect(line.filter((step) => !step.rest)).toHaveLength(1);
      for (const step of line) {
        expect(step).toMatchObject({ accent: false, slide: false, octave: 0 });
      }
    }
  });

  it('densité 1 : tous les pas joués, accentués, liés, et sautent d’octave hors du pas 0', () => {
    for (const line of lines({
      noteDensity: 1,
      accentDensity: 1,
      slideDensity: 1,
      octaveJumpDensity: 1,
    })) {
      for (const [index, step] of line.entries()) {
        expect(step).toMatchObject({ rest: false, accent: true, slide: true });
        if (index > 0) expect(step.octave).not.toBe(0);
      }
    }
  });

  it('favorise la tonique parmi les notes tirées', () => {
    const notes = drawnNotes({ noteDensity: 1, root: 0 });
    expectNear(
      share(notes, (s) => s.note === 0),
      GENERATOR_TONIC_WEIGHT,
    );
  });

  it('saute plus souvent vers l’octave supérieure', () => {
    const jumps = drawnNotes({ noteDensity: 1, octaveJumpDensity: 1 });
    expectNear(
      share(jumps, (s) => s.octave === 1),
      GENERATOR_OCTAVE_UP_RATIO,
    );
  });

  it('aucun slide vers un silence d’un seul pas, mais des slides à travers les plus longs', () => {
    let acrossLongerRests = 0;
    for (const line of lines({ noteDensity: 0.5, slideDensity: 1 })) {
      for (const [index, step] of line.entries()) {
        if (!step.slide) continue;
        const next = line[(index + 1) % 16];
        const afterNext = line[(index + 2) % 16];
        expect(next?.rest === true && afterNext?.rest === false).toBe(false);
        if (next?.rest === true) acrossLongerRests += 1;
      }
    }
    expect(acrossLongerRests).toBeGreaterThan(0);
  });

  it('un silence ne porte aucun drapeau', () => {
    const all = lines({ noteDensity: 0.5, accentDensity: 1, slideDensity: 1 }).flat();
    for (const step of all.filter((s) => s.rest)) {
      expect(step).toMatchObject({ accent: false, slide: false, octave: 0 });
    }
  });
});
