/**
 * Reducer pur : (état, commande) → nouvel état. Aucun effet de bord ; les
 * effets (démarrer le scheduler, programmer du son) sont dans index.ts.
 */
import type { ReducibleCommand } from './commands';
import { generateAcidLine } from './generator/acid-generator';
import { toSeed } from './generator/rng';
import { BPM_MAX, BPM_MIN } from './model/constants';
import { mutesOf } from './model/defaults';
import {
  DRUM_VOICES,
  type BassPattern,
  type DrumVoiceId,
  type DrumVoiceParams,
  type EngineState,
  type GeneratorParams,
  type MixParams,
  type PitchClass,
  type SidechainParams,
  type Step,
  type StepIndex,
  type Tuple16,
  type Velocity,
} from './model/types';

export function reduce(state: EngineState, command: ReducibleCommand): EngineState {
  switch (command.type) {
    case 'transport/play':
      return withTransport(state, { status: 'playing' });
    case 'transport/stop':
      return applyPendingMutes(withTransport(state, { status: 'stopped' }));
    case 'transport/setBpm':
      return withTransport(state, { bpm: clamp(command.bpm, BPM_MIN, BPM_MAX) });
    case 'transport/setShuffle':
      return withTransport(state, { shuffle: clamp(command.value, 0, 1) });
    case 'transport/setSidechain':
      return withTransport(state, {
        sidechain: { ...state.transport.sidechain, ...clampSidechain(command.patch) },
      });
    case 'pattern/setStep':
      return withBassStep(state, command.index, (step) => ({ ...step, ...command.patch }));
    case 'pattern/toggleStepFlag':
      return withBassStep(state, command.index, (step) => ({
        ...step,
        [command.flag]: !step[command.flag],
      }));
    case 'pattern/setDrumVelocity':
      return withDrumStep(state, command.voice, command.index, clamp(command.velocity, 0, 1));
    case 'bass/setWaveform':
      return { ...state, bass: { ...state.bass, waveform: command.waveform } };
    case 'bass/setKnob':
      return { ...state, bass: { ...state.bass, [command.knob]: clamp(command.value, 0, 1) } };
    case 'drums/setMuted': {
      const next = withDrumVoice(state, command.voice, { muted: command.muted });
      // À l'arrêt, aucune mesure à attendre.
      return next.transport.status === 'stopped' ? applyPendingMutes(next) : next;
    }
    case 'drums/setLevel':
      return withDrumVoice(state, command.voice, { level: clamp(command.value, 0, 1) });
    case 'mix/set':
      return { ...state, mix: { ...state.mix, ...clampPatch(command.patch) } };
    case 'generator/setParams':
      return { ...state, generator: { ...state.generator, ...clampGenerator(command.patch) } };
    case 'generator/run':
      return {
        ...state,
        pattern: { ...state.pattern, bass: generateAcidLine(state.generator, command.seed) },
        previousBass: state.pattern.bass,
      };
    case 'generator/undo':
      if (state.previousBass === null) return state;
      return {
        ...state,
        pattern: { ...state.pattern, bass: state.previousBass },
        previousBass: null,
      };
  }
}

/**
 * Rend audibles les mutes demandés. Appelé au pas 0 en lecture, pour qu'un
 * mute ou un démute tombe sur le début de la mesure. Retourne le même état
 * s'il n'y a rien en attente.
 */
export function applyPendingMutes(state: EngineState): EngineState {
  const requested = mutesOf(state.drums);
  const pending = DRUM_VOICES.some((voice) => requested[voice] !== state.appliedMutes[voice]);
  return pending ? { ...state, appliedMutes: requested } : state;
}

function withTransport(state: EngineState, patch: Partial<EngineState['transport']>): EngineState {
  return { ...state, transport: { ...state.transport, ...patch } };
}

function withBassStep(
  state: EngineState,
  index: StepIndex,
  update: (step: Step) => Step,
): EngineState {
  const current = state.pattern.bass[index];
  const bass = state.pattern.bass.map((step, i) => (i === index ? update(current) : step));
  return {
    ...state,
    pattern: { ...state.pattern, bass: bass as unknown as BassPattern },
    previousBass: null,
  };
}

function withDrumStep(
  state: EngineState,
  voice: DrumVoiceId,
  index: StepIndex,
  velocity: Velocity,
): EngineState {
  const row = state.pattern.drums[voice].map((value, i) => (i === index ? velocity : value));
  const drums = { ...state.pattern.drums, [voice]: row as unknown as Tuple16<Velocity> };
  return { ...state, pattern: { ...state.pattern, drums } };
}

function withDrumVoice(
  state: EngineState,
  voice: DrumVoiceId,
  patch: Partial<DrumVoiceParams>,
): EngineState {
  return { ...state, drums: { ...state.drums, [voice]: { ...state.drums[voice], ...patch } } };
}

function clampSidechain(patch: Partial<SidechainParams>): Partial<SidechainParams> {
  return patch.amount === undefined ? patch : { ...patch, amount: clamp(patch.amount, 0, 1) };
}

const GENERATOR_DENSITIES = [
  'noteDensity',
  'accentDensity',
  'slideDensity',
  'octaveJumpDensity',
] as const;

function clampGenerator(patch: Partial<GeneratorParams>): Partial<GeneratorParams> {
  let result = patch;
  for (const key of GENERATOR_DENSITIES) {
    const value = patch[key];
    if (value !== undefined) result = { ...result, [key]: clamp(value, 0, 1) };
  }
  if (patch.root !== undefined) {
    result = { ...result, root: clamp(Math.round(patch.root), 0, 11) as PitchClass };
  }
  if (patch.seed !== undefined && patch.seed !== null) {
    result = { ...result, seed: toSeed(patch.seed) };
  }
  return result;
}

function clampPatch(patch: Partial<MixParams>): Partial<MixParams> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'number') result[key] = clamp(value, 0, 1);
  }
  return result as Partial<MixParams>;
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
