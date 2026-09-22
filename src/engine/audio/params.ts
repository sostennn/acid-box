/**
 * Helpers d'automation sûrs pour les AudioParam.
 */
import { SCHEDULE_EPSILON_S } from '../model/constants';

/**
 * Un tick de scheduler en retard peut demander un événement déjà passé :
 * Web Audio l'exécuterait immédiatement mais les rampes qui suivent seraient
 * faussées. On le décale d'une marge après `currentTime`.
 */
export function safeTime(ctx: { readonly currentTime: number }, time: number): number {
  return Math.max(time, ctx.currentTime + SCHEDULE_EPSILON_S);
}
