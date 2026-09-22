/**
 * Arithmétique du geste de knob, pure et testable : traduit des déplacements
 * et des touches en nouvelle valeur normalisée.
 */

/** Déplacement du pointeur couvrant toute la plage 0 → 1. */
export const KNOB_DRAG_RANGE_PX = 200;
/** Facteur appliqué au déplacement en mode fin (Shift). */
export const KNOB_FINE_FACTOR = 0.125;
export const KNOB_KEY_STEP = 0.01;
export const KNOB_KEY_PAGE_STEP = 0.1;
/** Deux appuis dans cet intervalle, sans déplacement, remettent la valeur par défaut. */
export const KNOB_DOUBLE_TAP_MS = 300;
/** Au-delà de ce déplacement, un appui n'est plus un tap. */
export const KNOB_TAP_SLOP_PX = 4;

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Drag combiné : vers le haut ou vers la droite augmente, vers le bas ou vers
 * la gauche diminue. Relatif au dernier événement, donc jamais de saut.
 */
export function valueFromDrag(value: number, dx: number, dy: number, fine: boolean): number {
  const factor = fine ? KNOB_FINE_FACTOR : 1;
  return clamp01(value + ((dx - dy) / KNOB_DRAG_RANGE_PX) * factor);
}

/** Retourne null si la touche n'est pas gérée. */
export function valueFromKey(value: number, key: string): number | null {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return clamp01(value + KNOB_KEY_STEP);
    case 'ArrowDown':
    case 'ArrowLeft':
      return clamp01(value - KNOB_KEY_STEP);
    case 'PageUp':
      return clamp01(value + KNOB_KEY_PAGE_STEP);
    case 'PageDown':
      return clamp01(value - KNOB_KEY_PAGE_STEP);
    case 'Home':
      return 0;
    case 'End':
      return 1;
    default:
      return null;
  }
}
