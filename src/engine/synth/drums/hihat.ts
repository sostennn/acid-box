/**
 * Hats fermé et ouvert : même bruit passe-haut, seul le decay change. Le hat
 * ouvert est étouffé par la frappe de hat suivante (choke group).
 */
import {
  CLOSED_HAT_DECAY_TAU_S,
  DRUM_TAIL_TAUS,
  HAT_HIGHPASS_HZ,
  OPEN_HAT_DECAY_TAU_S,
} from '../../model/constants';
import type { DrumVoiceId } from '../../model/types';
import { startHit, type DrumPlayer } from './hit';

const createHat =
  (decayTau: number): DrumPlayer =>
  (target, spec, time) => {
    const { ctx } = target;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const vca = ctx.createGain();
    const decay = decayTau * spec.decayScale;

    source.buffer = target.noise;
    source.loop = true;
    filter.type = 'highpass';
    filter.frequency.value = HAT_HIGHPASS_HZ;
    vca.gain.setValueAtTime(spec.gain, time);
    vca.gain.setTargetAtTime(0, time, decay);
    source.connect(filter);
    filter.connect(vca);

    return startHit(target, {
      source,
      vca,
      nodes: [source, filter, vca],
      time,
      end: time + DRUM_TAIL_TAUS * decay,
    });
  };

export const playClosedHat = createHat(CLOSED_HAT_DECAY_TAU_S);
export const playOpenHat = createHat(OPEN_HAT_DECAY_TAU_S);

/** Toute frappe de hat, fermé ou ouvert, coupe le hat ouvert qui sonne. */
export function chokesOpenHat(voice: DrumVoiceId): boolean {
  return voice === 'closedHat' || voice === 'openHat';
}
