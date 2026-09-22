/**
 * Commandes acceptées par le moteur. L'union grandit lot par lot, ce qui
 * garde le reducer exhaustif à chaque étape.
 */
import type { Normalized } from './model/types';

export type Command =
  | { readonly type: 'transport/play' }
  | { readonly type: 'transport/stop' }
  | { readonly type: 'transport/setBpm'; readonly bpm: number }
  | { readonly type: 'transport/setShuffle'; readonly value: Normalized };
