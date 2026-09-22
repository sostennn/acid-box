/**
 * Helpers d'automation sûrs pour les AudioParam.
 */
import { KNOB_SMOOTHING_S, SCHEDULE_EPSILON_S } from '../model/constants';

/**
 * Un tick de scheduler en retard peut demander un événement déjà passé :
 * Web Audio l'exécuterait immédiatement mais les rampes qui suivent seraient
 * faussées. On le décale d'une marge après `currentTime`.
 */
export function safeTime(ctx: { readonly currentTime: number }, time: number): number {
  return Math.max(time, ctx.currentTime + SCHEDULE_EPSILON_S);
}

/**
 * Écriture « immédiate » d'un knob : jamais `param.value =`, qui produit un
 * saut audible (zipper noise), mais une courbe exponentielle très courte.
 */
export interface SmoothableParam {
  setTargetAtTime(value: number, startTime: number, timeConstant: number): unknown;
}

export function smoothSet(
  param: SmoothableParam,
  value: number,
  ctx: { readonly currentTime: number },
): void {
  param.setTargetAtTime(value, ctx.currentTime, KNOB_SMOOTHING_S);
}
