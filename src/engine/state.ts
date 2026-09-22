/**
 * Reducer pur : (état, commande) → nouvel état. Aucun effet de bord ; les
 * effets (démarrer le scheduler, programmer du son) sont dans index.ts.
 */
import type { Command } from './commands';
import { BPM_MAX, BPM_MIN } from './model/constants';
import type { BassPattern, EngineState, MixParams, Step, StepIndex } from './model/types';

export function reduce(state: EngineState, command: Command): EngineState {
  switch (command.type) {
    case 'transport/play':
      return withTransport(state, { status: 'playing' });
    case 'transport/stop':
      return withTransport(state, { status: 'stopped' });
    case 'transport/setBpm':
      return withTransport(state, { bpm: clamp(command.bpm, BPM_MIN, BPM_MAX) });
    case 'transport/setShuffle':
      return withTransport(state, { shuffle: clamp(command.value, 0, 1) });
    case 'pattern/setStep':
      return withBassStep(state, command.index, (step) => ({ ...step, ...command.patch }));
    case 'pattern/toggleStepFlag':
      return withBassStep(state, command.index, (step) => ({
        ...step,
        [command.flag]: !step[command.flag],
      }));
    case 'bass/setWaveform':
      return { ...state, bass: { ...state.bass, waveform: command.waveform } };
    case 'bass/setKnob':
      return { ...state, bass: { ...state.bass, [command.knob]: clamp(command.value, 0, 1) } };
    case 'mix/set':
      return { ...state, mix: { ...state.mix, ...clampPatch(command.patch) } };
  }
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
  return { ...state, pattern: { ...state.pattern, bass: bass as unknown as BassPattern } };
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
