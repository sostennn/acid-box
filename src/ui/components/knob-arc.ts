/** Géométrie de l'arc du knob, dans un viewBox 100 × 100. */

export const KNOB_SWEEP_DEG = 270;
export const KNOB_CENTER = 50;
export const KNOB_RADIUS = 40;

const START_DEG = -KNOB_SWEEP_DEG / 2;

/** Angle de l'indicateur pour une valeur normalisée, 0° = vers le haut. */
export function knobAngle(value: number): number {
  return START_DEG + value * KNOB_SWEEP_DEG;
}

function point(angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [KNOB_CENTER + KNOB_RADIUS * Math.cos(rad), KNOB_CENTER + KNOB_RADIUS * Math.sin(rad)];
}

/** Chemin SVG d'un arc entre deux valeurs normalisées. */
export function knobArcPath(from: number, to: number): string {
  const [a, b] = from <= to ? [from, to] : [to, from];
  if (b - a < 1e-6) return '';
  const [x1, y1] = point(knobAngle(a));
  const [x2, y2] = point(knobAngle(b));
  const largeArc = (b - a) * KNOB_SWEEP_DEG > 180 ? 1 : 0;
  return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${KNOB_RADIUS} ${KNOB_RADIUS} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
}
