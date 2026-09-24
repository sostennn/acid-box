/**
 * Clap : du bruit passe-bande en quelques bouffées rapprochées, comme
 * plusieurs mains qui ne frappent pas tout à fait ensemble, puis une queue.
 */
import {
  CLAP_BURST_COUNT,
  CLAP_BURST_INTERVAL_S,
  CLAP_BURST_TAU_S,
  CLAP_FILTER_HZ,
  CLAP_FILTER_Q,
  CLAP_TAIL_TAU_S,
  DRUM_TAIL_TAUS,
} from '../../model/constants';
import { startHit, type DrumPlayer } from './hit';

export const playClap: DrumPlayer = (target, spec, time) => {
  const { ctx } = target;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const vca = ctx.createGain();

  source.buffer = target.noise;
  source.loop = true;
  filter.type = 'bandpass';
  filter.frequency.value = CLAP_FILTER_HZ;
  filter.Q.value = CLAP_FILTER_Q;

  const last = time + (CLAP_BURST_COUNT - 1) * CLAP_BURST_INTERVAL_S;
  const tail = CLAP_TAIL_TAU_S * spec.decayScale;
  for (let burst = 0; burst < CLAP_BURST_COUNT; burst += 1) {
    const at = time + burst * CLAP_BURST_INTERVAL_S;
    vca.gain.setValueAtTime(spec.gain, at);
    vca.gain.setTargetAtTime(0, at, burst === CLAP_BURST_COUNT - 1 ? tail : CLAP_BURST_TAU_S);
  }

  source.connect(filter);
  filter.connect(vca);

  return startHit(target, {
    source,
    vca,
    nodes: [source, filter, vca],
    time,
    end: last + DRUM_TAIL_TAUS * tail,
  });
};
