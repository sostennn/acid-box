// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { knobDrag } from './knob-drag';
import { KNOB_DOUBLE_TAP_MS, KNOB_TAP_SLOP_PX } from './knob-math';

/** Monte l'action sur un nœud ; la valeur suit les `onchange`, comme le ferait l'état du moteur. */
function setup(initial = 0) {
  const node = document.createElement('div');
  let value = initial;
  const onchange = vi.fn((next: number) => {
    value = next;
  });
  const ontap = vi.fn();
  const ondefault = vi.fn();
  knobDrag(node, { getValue: () => value, onchange, ontap, ondefault });

  const pointer = (type: string, x: number, y: number, timeStamp = 0) => {
    const event = new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y });
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    node.dispatchEvent(event);
  };
  return { onchange, ontap, ondefault, pointer, value: () => value };
}

describe('knobDrag', () => {
  it('un tap reçoit la valeur de départ, même si un tremblement l’a déjà modifiée', () => {
    const { onchange, ontap, pointer, value } = setup(0);
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 0, -(KNOB_TAP_SLOP_PX / 2));
    pointer('pointerup', 0, -(KNOB_TAP_SLOP_PX / 2));
    expect(onchange).toHaveBeenCalled();
    expect(value()).toBeGreaterThan(0);
    expect(ontap).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('au-delà du seuil, c’est un glissé : pas de tap', () => {
    const { ontap, pointer } = setup(0.5);
    pointer('pointerdown', 0, 0);
    for (let y = -2; y >= -20; y -= 2) pointer('pointermove', 0, y);
    pointer('pointerup', 0, -20);
    expect(ontap).not.toHaveBeenCalled();
  });

  it('un appui annulé par le système n’est ni un tap ni la moitié d’un double-tap', () => {
    const { ontap, ondefault, pointer } = setup(0.5);
    // Horodatages de page déjà chargée : `timeStamp` part du chargement.
    const t0 = 10_000;
    pointer('pointerdown', 0, 0, t0);
    pointer('pointerup', 0, 0, t0 + 10);
    expect(ontap).toHaveBeenCalledTimes(1);

    pointer('pointerdown', 0, 0, t0 + 50);
    pointer('pointercancel', 0, 0, t0 + 60);
    expect(ontap).toHaveBeenCalledTimes(1);

    pointer('pointerdown', 0, 0, t0 + 80);
    pointer('pointerup', 0, 0, t0 + 90);
    expect(90 - 10).toBeLessThan(KNOB_DOUBLE_TAP_MS);
    expect(ondefault).not.toHaveBeenCalled();
    expect(ontap).toHaveBeenCalledTimes(2);
  });
});
