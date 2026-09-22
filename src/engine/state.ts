/**
 * Reducer pur : (état, commande) → nouvel état. Aucun effet de bord ; les
 * effets (démarrer le scheduler, programmer du son) sont dans index.ts.
 */
import type { Command } from './commands';
import { BPM_MAX, BPM_MIN } from './model/constants';
import type { EngineState } from './model/types';

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
  }
}

function withTransport(state: EngineState, patch: Partial<EngineState['transport']>): EngineState {
  return { ...state, transport: { ...state.transport, ...patch } };
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
