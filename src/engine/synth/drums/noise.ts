/**
 * Bruit blanc généré procéduralement, une fois par contexte : aucun asset
 * audio. Les frappes le lisent en boucle.
 */
import type { AudioContextLike } from '../../audio/context';
import { NOISE_BUFFER_S } from '../../model/constants';

export function createNoiseBuffer(
  ctx: AudioContextLike,
  random: () => number = Math.random,
): AudioBuffer {
  const length = Math.max(1, Math.round(ctx.sampleRate * NOISE_BUFFER_S));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = random() * 2 - 1;
  return buffer;
}
