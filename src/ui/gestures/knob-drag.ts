/**
 * Action Svelte du geste de knob : Pointer Events avec capture, souris et
 * tactile, drag relatif combiné, mode fin avec Shift, tap, double-tap = valeur
 * par défaut, clavier. Ne calcule rien : délègue à knob-math.
 */
import type { Action } from 'svelte/action';
import { KNOB_DOUBLE_TAP_MS, KNOB_TAP_SLOP_PX, valueFromDrag, valueFromKey } from './knob-math';

export interface KnobDragParams {
  /** Lue à chaque événement : l'action ne garde pas de copie de la valeur. */
  readonly getValue: () => number;
  readonly onchange: (value: number) => void;
  readonly ondefault?: () => void;
  /**
   * Appui sans déplacement, à chaque tap (une case de grille bascule ainsi).
   * Reçoit la valeur lue à l'appui : un tremblement sous le seuil de tap a pu
   * déjà la modifier, la bascule doit se décider d'après l'état de départ.
   */
  readonly ontap?: (startValue: number) => void;
}

export const knobDrag: Action<HTMLElement, KnobDragParams> = (node, params) => {
  let current = params;
  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let moved = 0;
  let startValue = 0;
  let lastTapAt = 0;

  const onPointerDown = (event: PointerEvent) => {
    if (pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    moved = 0;
    startValue = current.getValue();
    if (typeof node.setPointerCapture === 'function') node.setPointerCapture(pointerId);
    node.focus({ preventScroll: true });
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    current.onchange(valueFromDrag(current.getValue(), dx, dy, event.shiftKey));
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (moved > KNOB_TAP_SLOP_PX) {
      lastTapAt = 0;
      return;
    }
    current.ontap?.(startValue);
    const now = event.timeStamp;
    if (now - lastTapAt < KNOB_DOUBLE_TAP_MS) {
      lastTapAt = 0;
      current.ondefault?.();
    } else {
      lastTapAt = now;
    }
  };

  // Un appui annulé par le système n'est ni un tap ni la moitié d'un double-tap.
  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    lastTapAt = 0;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const next = valueFromKey(current.getValue(), event.key);
    if (next === null) return;
    event.preventDefault();
    current.onchange(next);
  };

  node.style.touchAction = 'none';
  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', onPointerUp);
  node.addEventListener('pointercancel', onPointerCancel);
  node.addEventListener('keydown', onKeyDown);

  return {
    update(next) {
      current = next;
    },
    destroy() {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerCancel);
      node.removeEventListener('keydown', onKeyDown);
    },
  };
};
