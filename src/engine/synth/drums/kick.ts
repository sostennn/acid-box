/**
 * Kick : un sinus dont la hauteur plonge pendant que l'amplitude décroît.
 */
import {
  DRUM_TAIL_TAUS,
  KICK_DECAY_TAU_S,
  KICK_PITCH_END_HZ,
  KICK_PITCH_START_HZ,
  KICK_PITCH_TAU_S,
} from '../../model/constants';
import { startHit, type DrumPlayer } from './hit';

export const playKick: DrumPlayer = (target, spec, time) => {
  const oscillator = target.ctx.createOscillator();
  const vca = target.ctx.createGain();
  const decay = KICK_DECAY_TAU_S * spec.decayScale;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(KICK_PITCH_START_HZ, time);
  oscillator.frequency.setTargetAtTime(KICK_PITCH_END_HZ, time, KICK_PITCH_TAU_S);
  vca.gain.setValueAtTime(spec.gain, time);
  vca.gain.setTargetAtTime(0, time, decay);
  oscillator.connect(vca);

  return startHit(target, {
    source: oscillator,
    vca,
    nodes: [oscillator, vca],
    time,
    end: time + DRUM_TAIL_TAUS * decay,
  });
};
