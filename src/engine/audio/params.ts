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

/**
 * Événement d'automation décrit sous forme de données par un plan pur, puis
 * appliqué à un AudioParam par la voix qui le possède.
 */
export type AutomationEvent =
  | { readonly kind: 'cancel'; readonly time: number }
  | { readonly kind: 'set'; readonly time: number; readonly value: number }
  | {
      readonly kind: 'target';
      readonly time: number;
      readonly value: number;
      readonly timeConstant: number;
    };

export function applyAutomation(
  param: AudioParam,
  event: AutomationEvent,
  ctx: { readonly currentTime: number },
): void {
  const time = safeTime(ctx, event.time);
  switch (event.kind) {
    case 'cancel':
      param.cancelScheduledValues(time);
      return;
    case 'set':
      param.setValueAtTime(event.value, time);
      return;
    case 'target':
      param.setTargetAtTime(event.value, time, event.timeConstant);
      return;
  }
}
