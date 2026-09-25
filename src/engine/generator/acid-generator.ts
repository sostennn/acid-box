/**
 * Génération contrainte d'une ligne de basse acid. Pur : à paramètres et seed
 * égaux, même ligne. Ne touche pas à la rythmique.
 */
import { GENERATOR_OCTAVE_UP_RATIO, GENERATOR_TONIC_WEIGHT, STEP_COUNT } from '../model/constants';
import { DEFAULT_STEP, tuple16 } from '../model/defaults';
import { scalePitchClasses } from '../model/scales';
import type { BassPattern, GeneratorParams, OctaveOffset, Step, Tuple16 } from '../model/types';
import { chance, createRng, pick, type Rng } from './rng';

export type LineParams = Omit<GeneratorParams, 'seed'>;

export function generateAcidLine(params: LineParams, seed: number): BassPattern {
  const rng = createRng(seed);
  const { root } = params;
  const otherDegrees = scalePitchClasses(params.scale, root).filter((note) => note !== root);
  // Le pas 0 porte toujours la tonique : la boucle retombe sur ses pieds.
  const played = tuple16((index) => index === 0 || chance(rng, params.noteDensity));

  return tuple16((index): Step => {
    if (!played[index]) return { ...DEFAULT_STEP, note: root, rest: true };
    const first = index === 0;
    const note = first || chance(rng, GENERATOR_TONIC_WEIGHT) ? root : pick(rng, otherDegrees);
    return {
      note: note ?? root,
      octave: first ? 0 : octaveJump(rng, params.octaveJumpDensity),
      accent: chance(rng, params.accentDensity),
      slide: chance(rng, params.slideDensity) && !beforeIsolatedRest(played, index),
      rest: false,
    };
  });
}

function octaveJump(rng: Rng, density: number): OctaveOffset {
  if (!chance(rng, density)) return 0;
  return chance(rng, GENERATOR_OCTAVE_UP_RATIO) ? 1 : -1;
}

/**
 * Un slide tient la note à travers les silences jusqu'au pas joué suivant. Vers
 * un silence d'un seul pas, il le comblerait et effacerait le trou rythmique.
 */
function beforeIsolatedRest(played: Tuple16<boolean>, index: number): boolean {
  const next = played[(index + 1) % STEP_COUNT];
  const afterNext = played[(index + 2) % STEP_COUNT];
  return next === false && afterNext === true;
}
