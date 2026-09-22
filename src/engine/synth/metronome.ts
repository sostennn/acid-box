/**
 * Clic de métronome synthétisé, une source par frappe. Provisoire : sert à
 * entendre la grille tant que la voix basse n'existe pas (retiré au lot 3).
 */
import type { AudioContextLike } from '../audio/context';
import { safeTime } from '../audio/params';
import {
  METRONOME_DECAY_S,
  METRONOME_DOWNBEAT_FREQUENCY_HZ,
  METRONOME_FREQUENCY_HZ,
  METRONOME_OFFBEAT_RATIO,
  METRONOME_PEAK_GAIN,
  MIN_GAIN,
} from '../model/constants';
import type { StepIndex } from '../model/types';

export interface Metronome {
  trigger(step: StepIndex, time: number): void;
}

export function createMetronome(ctx: AudioContextLike): Metronome {
  return {
    trigger(step, time) {
      const start = safeTime(ctx, time);
      const stop = start + METRONOME_DECAY_S;
      const onBeat = step % 4 === 0;

      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(
        step === 0 ? METRONOME_DOWNBEAT_FREQUENCY_HZ : METRONOME_FREQUENCY_HZ,
        start,
      );

      const vca = ctx.createGain();
      vca.gain.setValueAtTime(
        onBeat ? METRONOME_PEAK_GAIN : METRONOME_PEAK_GAIN * METRONOME_OFFBEAT_RATIO,
        start,
      );
      vca.gain.exponentialRampToValueAtTime(MIN_GAIN, stop);

      oscillator.connect(vca);
      vca.connect(ctx.destination);
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect();
        vca.disconnect();
      });
      oscillator.start(start);
      oscillator.stop(stop);
    },
  };
}
