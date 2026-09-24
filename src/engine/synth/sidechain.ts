/**
 * Sidechain : un gain dédié entre le bus basse et le master, qui plonge à
 * chaque kick joué puis remonte. Séparé du niveau de mix de la basse pour que
 * le knob et le ducking ne se battent jamais sur le même AudioParam.
 */
import type { AudioContextLike } from '../audio/context';
import { applyAutomation, safeTime, type AutomationEvent } from '../audio/params';
import {
  KNOB_SMOOTHING_S,
  SIDECHAIN_ATTACK_S,
  SIDECHAIN_HOLD_S,
  SIDECHAIN_MAX_DEPTH,
  SIDECHAIN_RELEASE_S,
} from '../model/constants';
import type { SidechainParams, Velocity } from '../model/types';

export interface DuckInput {
  /** Temps audio du pas, shuffle inclus. */
  readonly time: number;
  readonly kickVelocity: Velocity;
  readonly kickMuted: boolean;
  readonly params: SidechainParams;
}

export function planDuck({ time, kickVelocity, kickMuted, params }: DuckInput): AutomationEvent[] {
  if (!params.enabled || kickMuted || !(kickVelocity > 0) || !(params.amount > 0)) return [];
  const floor = 1 - Math.min(1, params.amount) * SIDECHAIN_MAX_DEPTH;
  return [
    { kind: 'cancel', time },
    { kind: 'target', time, value: floor, timeConstant: SIDECHAIN_ATTACK_S },
    { kind: 'target', time: time + SIDECHAIN_HOLD_S, value: 1, timeConstant: SIDECHAIN_RELEASE_S },
  ];
}

export interface Sidechain {
  readonly node: GainNode;
  duck(input: DuckInput): void;
  /** Désactivé en cours de ducking : la basse remonte tout de suite. */
  applyParams(params: SidechainParams): void;
  release(time: number): void;
  dispose(): void;
}

export function createSidechain(ctx: AudioContextLike): Sidechain {
  const node = ctx.createGain();
  node.gain.value = 1;

  const restore = (time: number) => {
    const at = safeTime(ctx, time);
    node.gain.cancelScheduledValues(at);
    node.gain.setTargetAtTime(1, at, KNOB_SMOOTHING_S);
  };

  return {
    node,
    duck(input) {
      planDuck(input).forEach((event) => applyAutomation(node.gain, event, ctx));
    },
    applyParams(params) {
      if (!params.enabled) restore(ctx.currentTime);
    },
    release: restore,
    dispose: () => node.disconnect(),
  };
}
