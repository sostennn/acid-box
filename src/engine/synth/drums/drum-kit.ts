/**
 * Boîte à rythmes : une tranche persistante par voix, et des frappes créées à
 * la demande. La tranche enchaîne deux gains : le niveau, écrit tout de suite
 * par le knob, et le mute, programmé au temps de la mesure. Séparés, un knob
 * tourné pendant qu'un mute attend la mesure ne l'avance jamais.
 */
import type { AudioContextLike } from '../../audio/context';
import { safeTime, smoothSet } from '../../audio/params';
import { DRUM_CUT_TAU_S } from '../../model/constants';
import { levelToGain } from '../../model/mapping';
import {
  DRUM_VOICES,
  type DrumMutes,
  type DrumParams,
  type DrumVoiceId,
  type Velocity,
} from '../../model/types';
import { playClap } from './clap';
import { planDrumHit } from './drum-plan';
import { chokesOpenHat, playClosedHat, playOpenHat } from './hihat';
import type { DrumHit, DrumPlayer } from './hit';
import { playKick } from './kick';
import { createNoiseBuffer } from './noise';

export interface DrumTrigger {
  readonly voice: DrumVoiceId;
  readonly velocity: Velocity;
  readonly muted: boolean;
  /** Temps audio du pas, shuffle inclus. */
  readonly time: number;
}

export interface DrumKit {
  trigger(input: DrumTrigger): void;
  /** Niveaux : écriture lissée immédiate, qui s'applique aussi aux queues en cours. */
  applyLevels(params: DrumParams): void;
  /** Mutes : appliqués à `time`, le début d'une mesure en lecture. */
  applyMutes(mutes: DrumMutes, time: number): void;
  /** Coupe sans clic tout ce qui sonne ou est déjà programmé. */
  release(time: number): void;
  dispose(): void;
}

const PLAYERS: Readonly<Record<DrumVoiceId, DrumPlayer>> = {
  kick: playKick,
  clap: playClap,
  closedHat: playClosedHat,
  openHat: playOpenHat,
};

interface Channel {
  readonly level: GainNode;
  readonly mute: GainNode;
}

export function createDrumKit(
  ctx: AudioContextLike,
  output: AudioNode,
  levels: DrumParams,
  initialMutes: DrumMutes,
): DrumKit {
  const noise = createNoiseBuffer(ctx);
  const createChannel = (voice: DrumVoiceId): Channel => {
    const level = ctx.createGain();
    const mute = ctx.createGain();
    level.gain.value = levelToGain(levels[voice].level);
    mute.gain.value = initialMutes[voice] ? 0 : 1;
    level.connect(mute);
    mute.connect(output);
    return { level, mute };
  };
  const channels: Readonly<Record<DrumVoiceId, Channel>> = {
    kick: createChannel('kick'),
    clap: createChannel('clap'),
    closedHat: createChannel('closedHat'),
    openHat: createChannel('openHat'),
  };
  let mutes = initialMutes;

  // Frappes qui sonnent encore ou sont déjà programmées, retirées à `ended`.
  // Le stop et l'étouffement du hat ouvert se décident d'après ce qui sonne
  // réellement, pas d'après le pattern.
  const live = new Map<DrumHit, DrumVoiceId>();
  const onEnded = (hit: DrumHit) => live.delete(hit);

  const cut = (time: number, only?: DrumVoiceId) => {
    for (const [hit, voice] of live) {
      if (only !== undefined && voice !== only) continue;
      hit.cut(time);
      live.delete(hit);
    }
  };

  return {
    trigger({ voice, velocity, muted, time }) {
      const spec = planDrumHit(velocity, muted);
      if (spec === null) return;
      const at = safeTime(ctx, time);
      if (chokesOpenHat(voice)) cut(at, 'openHat');
      const hit = PLAYERS[voice]({ ctx, output: channels[voice].level, noise, onEnded }, spec, at);
      live.set(hit, voice);
    },
    applyLevels(params) {
      for (const voice of DRUM_VOICES) {
        smoothSet(channels[voice].level.gain, levelToGain(params[voice].level), ctx);
      }
    },
    applyMutes(next, time) {
      const at = safeTime(ctx, time);
      for (const voice of DRUM_VOICES) {
        if (next[voice] === mutes[voice]) continue;
        const { gain } = channels[voice].mute;
        gain.cancelScheduledValues(at);
        // Un mute coupe les queues sans clic. Un démute peut sauter d'un coup :
        // la voix mutée n'a joué aucune frappe, sa tranche est silencieuse, et
        // la frappe du temps garde ainsi son attaque.
        if (next[voice]) gain.setTargetAtTime(0, at, DRUM_CUT_TAU_S);
        else gain.setValueAtTime(1, at);
      }
      mutes = next;
    },
    release(time) {
      cut(safeTime(ctx, time));
    },
    dispose() {
      cut(safeTime(ctx, ctx.currentTime));
      for (const voice of DRUM_VOICES) {
        channels[voice].level.disconnect();
        channels[voice].mute.disconnect();
      }
    },
  };
}
