// @vitest-environment happy-dom
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { KNOB_DRAG_RANGE_PX, KNOB_FINE_FACTOR, KNOB_KEY_STEP } from '../gestures/knob-math';
import Knob from './Knob.svelte';

function renderKnob(value = 0.5) {
  const onchange = vi.fn();
  const utils = render(Knob, { value, label: 'Cutoff', defaultValue: 0.25, onchange });
  const dial = utils.getByRole('slider');
  return { ...utils, dial, onchange };
}

const pointer = (type: string, target: Element, x: number, y: number, extra = {}) =>
  fireEvent(
    target,
    new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true, ...extra }),
  );

describe('Knob', () => {
  it('expose un slider accessible avec la valeur formatée', () => {
    const { dial } = renderKnob(0.5);
    expect(dial.getAttribute('aria-valuenow')).toBe('50');
    expect(dial.getAttribute('aria-valuetext')).toBe('50 %');
    expect(dial.getAttribute('aria-label')).toBe('Cutoff');
  });

  it('un drag vertical relatif émet des valeurs bornées', async () => {
    const { dial, onchange } = renderKnob(0.5);
    await pointer('pointerdown', dial, 100, 100);
    await pointer('pointermove', dial, 100, 80);
    expect(onchange).toHaveBeenLastCalledWith(expect.closeTo(0.5 + 20 / KNOB_DRAG_RANGE_PX, 10));
    await pointer('pointermove', dial, 100, 1000);
    expect(onchange).toHaveBeenLastCalledWith(0);
    await pointer('pointerup', dial, 100, 1000);
  });

  it('Shift réduit la sensibilité', async () => {
    const { dial, onchange } = renderKnob(0.5);
    await pointer('pointerdown', dial, 0, 0);
    await pointer('pointermove', dial, 0, -40, { shiftKey: true });
    expect(onchange).toHaveBeenLastCalledWith(
      expect.closeTo(0.5 + (40 / KNOB_DRAG_RANGE_PX) * KNOB_FINE_FACTOR, 10),
    );
  });

  it('ignore les mouvements d’un autre pointeur que celui capturé', async () => {
    const { dial, onchange } = renderKnob(0.5);
    await pointer('pointerdown', dial, 0, 0);
    await fireEvent(
      dial,
      new PointerEvent('pointermove', { pointerId: 2, clientX: 0, clientY: -50 }),
    );
    expect(onchange).not.toHaveBeenCalled();
  });

  it('un double-tap sans déplacement remet la valeur par défaut', async () => {
    const { dial, onchange } = renderKnob(0.5);
    await pointer('pointerdown', dial, 10, 10);
    await pointer('pointerup', dial, 10, 10);
    await pointer('pointerdown', dial, 11, 10);
    await pointer('pointerup', dial, 11, 10);
    expect(onchange).toHaveBeenLastCalledWith(0.25);
  });

  it('un drag suivi d’un tap ne déclenche pas la valeur par défaut', async () => {
    const { dial, onchange } = renderKnob(0.5);
    await pointer('pointerdown', dial, 10, 10);
    await pointer('pointermove', dial, 10, -30);
    await pointer('pointerup', dial, 10, -30);
    onchange.mockClear();
    await pointer('pointerdown', dial, 10, 10);
    await pointer('pointerup', dial, 10, 10);
    expect(onchange).not.toHaveBeenCalled();
  });

  it('répond au clavier', async () => {
    const { dial, onchange } = renderKnob(0.5);
    await fireEvent.keyDown(dial, { key: 'ArrowUp' });
    expect(onchange).toHaveBeenLastCalledWith(expect.closeTo(0.5 + KNOB_KEY_STEP, 10));
    await fireEvent.keyDown(dial, { key: 'End' });
    expect(onchange).toHaveBeenLastCalledWith(1);
  });
});
